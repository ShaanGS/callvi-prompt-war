import { randomUUID } from "node:crypto";
import type { LanguageCode } from "@/lib/languages";
import { classifyVoiceError, initialVoiceState, voiceReducer } from "@/lib/voice/voice-state";
import type { AppConfig } from "../config/env";
import type { Db, Queryable } from "../db/types";
import type { Channel, Learner, LearningSession } from "../domain/types";
import { learnerService } from "../services/learner-service";
import { sessionService } from "../services/session-service";
import { sessionsRepo } from "../repositories/sessions";
import { courseService, findExercise } from "../services/course-service";
import { assessAnswer } from "../services/assessment/assessment-service";
import { handleSarvamToolCallback } from "../providers/sarvam/tool-callback";
import { agentInstructions } from "../providers/sarvam/agent-setup";
import { runTool, type ToolResponse } from "./orchestrator";

/**
 * AgentEvaluation — repeatable scenarios for the parts of the agent the
 * application owns: tool contracts, context, policy, memory and failure
 * handling. Each scenario drives the real orchestrator and database.
 *
 * What this does NOT evaluate: the provider's language model, speech
 * recognition or speech synthesis. Each scenario therefore also carries a
 * conversation script (`conversation`) to run as a test case against the
 * configured Sarvam agent (exported by `npm run agent:eval-export`).
 */

export interface ConversationCase {
  learnerSays: string[];
  expectedBehaviour: string[];
}

export interface Harness {
  db: Db;
  learner: Learner;
  session: LearningSession;
  /** Run a tool through the orchestrator as the agent would. */
  call(tool: string, args?: Record<string, unknown>, opts?: { timeoutMs?: number; idempotencyKey?: string; dbLatencyMs?: number }): Promise<ToolResponse>;
  /** Start a fresh session for the same learner (a later, separate session). */
  newSession(channel?: Channel): Promise<LearningSession>;
  check(condition: boolean, message: string): void;
  count(table: string): Promise<number>;
}

export interface AgentScenario {
  id: number;
  title: string;
  learner: { consent: "granted" | "declined" | "pending"; language: LanguageCode };
  conversation: ConversationCase;
  run(h: Harness): Promise<void>;
}

export interface ScenarioResult {
  id: number;
  title: string;
  passed: boolean;
  failures: string[];
}

const LEARNER_TABLES = new Set(["learner_goals", "enrollments", "practice_attempts", "learning_checkpoints", "learner_memory", "concept_mastery"]);
const SHAMING = /\b(wrong!|stupid|lazy|careless|failed|bad answer|obviously)\b/i;
const TAMIL = /[஀-௿]/;

function ok(r: ToolResponse): r is Extract<ToolResponse, { ok: true }> {
  return r.ok;
}
function errorCode(r: ToolResponse): string | null {
  return r.ok ? null : r.error.code;
}
function field(r: ToolResponse, key: string): unknown {
  return r.ok ? r.data[key] : undefined;
}
function obj(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : {};
}

export const AGENT_SCENARIOS: AgentScenario[] = [
  {
    id: 1,
    title: "No specific goal: gentle goal discovery",
    learner: { consent: "granted", language: "en-IN" },
    conversation: {
      learnerSays: ["I don't really know what I need. I just want to earn something from home."],
      expectedBehaviour: [
        "Asks one open question about what the learner would like to be able to do.",
        "Does not push a course before a goal is confirmed.",
        "Restates the goal and asks for confirmation before saving it.",
      ],
    },
    async run(h) {
      const ctx = await h.call("get_learning_context");
      h.check(field(ctx, "suggested_next_action") === "discover_goal", "context suggests goal discovery when there is no goal");
      const list = await h.call("list_courses", {});
      const recIds = field(list, "recommended_course_ids");
      h.check(ok(list) && Array.isArray(recIds) && recIds.length === 0, "no recommendation is forced without a goal");
      const unconfirmed = await h.call("set_learning_goal", { goal_text: "earn from home" });
      h.check(errorCode(unconfirmed) === "VALIDATION" && !unconfirmed.ok && unconfirmed.saved === false, "a goal is not saved without learner confirmation");
      h.check((await h.count("learner_goals")) === 0, "no goal row was written");
    },
  },
  {
    id: 2,
    title: "Learner chooses Small Business Starter and confirms a goal",
    learner: { consent: "granted", language: "en-IN" },
    conversation: {
      learnerSays: ["I make murukku at home and want to sell it properly.", "Yes, that's right.", "The small business one."],
      expectedBehaviour: ["Restates and confirms the goal.", "Offers at most three courses with a reason.", "Enrols only after the learner chooses."],
    },
    async run(h) {
      const goal = await h.call("set_learning_goal", { goal_text: "Sell my homemade murukku and price it properly", learner_confirmed: true });
      h.check(ok(goal) && goal.saved === true, "confirmed goal is saved");
      const list = await h.call("list_courses", {});
      const recommended = field(list, "recommended_course_ids");
      h.check(Array.isArray(recommended) && recommended[0] === "small-business-starter", "Small Business Starter is recommended first for this goal");
      const noConfirm = await h.call("start_or_resume_course", { course_id: "small-business-starter" });
      h.check(!noConfirm.ok, "enrolment requires the learner's explicit choice");
      const enrol = await h.call("start_or_resume_course", { course_id: "small-business-starter", learner_confirmed: true });
      h.check(ok(enrol) && enrol.saved === true, "enrolment is saved after the learner chooses");
      h.check(obj(field(enrol, "current_lesson")).id === "sbs-01", "the course starts at lesson 1");
      h.check((await h.count("enrollments")) === 1, "exactly one enrolment exists");
    },
  },
  {
    id: 3,
    title: "Learner asks for a different explanation; the approach changes",
    learner: { consent: "granted", language: "en-IN" },
    conversation: {
      learnerSays: ["I didn't understand that.", "Can you say it another way?"],
      expectedBehaviour: ["Uses a different teaching approach, not the same words again.", "Keeps to the course's facts."],
    },
    async run(h) {
      await h.call("start_or_resume_course", { course_id: "small-business-starter", learner_confirmed: true });
      const first = await h.call("get_lesson_context", {});
      const second = await h.call("get_lesson_context", { request: "different_explanation" });
      const a1 = obj(field(first, "explanation_status")).approach;
      const a2 = obj(field(second, "explanation_status")).approach;
      h.check(typeof a1 === "string" && typeof a2 === "string" && a1 !== a2, "a different explanation uses a different approach");
      h.check(obj(field(first, "concept")).explanation !== obj(field(second, "concept")).explanation, "the explanation text changes");
      h.check(obj(field(first, "concept")).id === obj(field(second, "concept")).id, "the idea being taught stays the same");
      const repeat = await h.call("get_lesson_context", { request: "repeat" });
      h.check(obj(field(repeat, "explanation_status")).approach === a2, "'repeat' repeats the latest approach");
    },
  },
  {
    id: 4,
    title: "Learner interrupts or changes topic mid-explanation",
    learner: { consent: "granted", language: "en-IN" },
    conversation: {
      learnerSays: ["(interrupting) Wait — can we skip to talking to customers?", "OK, go back to where we were."],
      expectedBehaviour: [
        "Stops speaking and listens (barge-in is handled by the provider).",
        "Explains that lessons open in order, without losing the place.",
        "Returns to the same idea.",
      ],
    },
    async run(h) {
      await h.call("start_or_resume_course", { course_id: "small-business-starter", learner_confirmed: true });
      const before = await h.call("get_lesson_context", {});
      const skip = await h.call("get_lesson_context", { lesson_id: "sbs-03" });
      h.check(errorCode(skip) === "POLICY_VIOLATION", "jumping to a locked lesson is refused by policy");
      const moveOn = await h.call("get_lesson_context", { request: "move_on" });
      h.check(errorCode(moveOn) === "POLICY_VIOLATION", "moving on requires at least one practice attempt");
      const back = await h.call("get_lesson_context", {});
      h.check(obj(field(back, "concept")).id === obj(field(before, "concept")).id, "the learner's place is unchanged after the interruption");
      h.check(h.session.state.lessonId === "sbs-01", "session state still points at lesson 1");
    },
  },
  {
    id: 5,
    title: "Partially correct and incorrect practice answers",
    learner: { consent: "granted", language: "en-IN" },
    conversation: {
      learnerSays: ["I sell snacks.", "(for the unit-cost question) 120 rupees"],
      expectedBehaviour: ["Says what was right and what is missing.", "Explains the likely slip in the calculation without shaming.", "Offers a retry or a different explanation."],
    },
    async run(h) {
      await h.call("start_or_resume_course", { course_id: "small-business-starter", learner_confirmed: true });
      await h.call("get_lesson_context", {});
      const partial = await h.call("record_practice_attempt", { exercise_id: "sbs-01-offer-sentence", answer_text: "I sell snacks" });
      const r1 = field(partial, "result");
      h.check(r1 === "partial" || r1 === "needs_practice", `an incomplete answer is not marked correct (got ${String(r1)})`);
      h.check(typeof field(partial, "feedback") === "string" && !SHAMING.test(String(field(partial, "feedback"))), "feedback contains no shaming language");
      h.check(field(partial, "next_step") === "retry", "first miss offers a retry");
      const second = await h.call("record_practice_attempt", { exercise_id: "sbs-01-offer-sentence", answer_text: "snacks" });
      h.check(field(second, "next_step") === "offer_move_on", "after two misses the learner may move on");
      h.check(typeof field(second, "model_answer") === "string", "the example answer is shown after the second attempt");

      const course = await courseService.getAvailable(h.db, "small-business-starter");
      const { exercise } = findExercise(course, "sbs-02-unit-cost");
      const wrong = assessAnswer({ exercise, answerText: "120 rupees", language: "en-IN", attemptNumber: 1 });
      h.check(wrong.result === "needs_practice", "a wrong calculation is assessed as needs_practice");
      h.check(wrong.mistakeExplanation !== null, "the likely calculation slip is explained");
      h.check(!SHAMING.test(wrong.feedback), "calculation feedback contains no shaming language");
    },
  },
  {
    id: 6,
    title: "Supported Tamil/English switching (application level)",
    learner: { consent: "granted", language: "ta-IN" },
    conversation: {
      learnerSays: ["வணக்கம்", "Can we continue in English?", "ஒரு முறுக்குக்கு பன்னிரண்டு ரூபாய்"],
      expectedBehaviour: [
        "Starts in Tamil.",
        "Switches to English when asked and saves the preference.",
        "Accepts a Tamil number word in a practice answer.",
        "Code-mixing quality is NOT claimed until tested with Tamil speakers.",
      ],
    },
    async run(h) {
      await h.call("start_or_resume_course", { course_id: "small-business-starter", learner_confirmed: true });
      const ta = await h.call("get_lesson_context", {});
      h.check(TAMIL.test(String(obj(field(ta, "concept")).explanation)), "lesson content is returned in Tamil");
      const sw = await h.call("update_memory_preference", { key: "preferred_language", value: "English", learner_confirmed: true });
      h.check(ok(sw) && sw.saved === true, "language switch is saved for a consenting learner");
      const en = await h.call("get_lesson_context", { request: "repeat" });
      h.check(!TAMIL.test(String(obj(field(en, "concept")).explanation)), "lesson content is returned in English after switching");
      const bad = await h.call("update_memory_preference", { key: "preferred_language", value: "Hindi", learner_confirmed: true });
      h.check(errorCode(bad) === "VALIDATION", "unsupported languages are refused");

      const course = await courseService.getAvailable(h.db, "small-business-starter");
      const { exercise } = findExercise(course, "sbs-02-unit-cost");
      const tamilNumber = assessAnswer({ exercise, answerText: "ஒரு முறுக்குக்கு பன்னிரண்டு ரூபாய்", language: "ta-IN", attemptNumber: 1 });
      h.check(tamilNumber.result === "correct", "a Tamil number word is understood in a numeric answer");
    },
  },
  {
    id: 7,
    title: "Question outside the course scope",
    learner: { consent: "granted", language: "en-IN" },
    conversation: {
      learnerSays: ["Which bank gives the cheapest loan?", "Can you guarantee I'll make money?"],
      expectedBehaviour: ["Says honestly this is outside the course.", "Does not give loan advice or promise income.", "Offers to return to the lesson."],
    },
    async run(h) {
      await h.call("start_or_resume_course", { course_id: "small-business-starter", learner_confirmed: true });
      const other = await h.call("get_lesson_context", { lesson_id: "dbb-01" });
      h.check(!other.ok, "content from another course is not served inside this course");
      const foreign = await h.call("record_practice_attempt", { exercise_id: "dbb-01-daily-total", answer_text: "280" });
      h.check(!foreign.ok && foreign.saved === false, "practice from another course is not recorded");
      const prompt = agentInstructions("browser");
      h.check(/regulated financial advice/.test(prompt) && /Never promise income/.test(prompt), "agent instructions state the scope limits");
    },
  },
  {
    id: 8,
    title: "Learner declines durable memory",
    learner: { consent: "pending", language: "en-IN" },
    conversation: {
      learnerSays: ["No, don't save anything."],
      expectedBehaviour: ["Confirms learning continues for this session only.", "Never says anything was saved."],
    },
    async run(h) {
      const consent = await h.call("set_memory_consent", { decision: "declined", learner_confirmed: true });
      h.check(field(consent, "memory_mode") === "session_only", "memory mode becomes session-only");
      const goal = await h.call("set_learning_goal", { goal_text: "Learn to keep sales records", learner_confirmed: true });
      h.check(ok(goal) && goal.saved === false, "goal is kept for the session but reported as not saved");
      const enrol = await h.call("start_or_resume_course", { course_id: "digital-business-basics", learner_confirmed: true });
      h.check(ok(enrol) && enrol.saved === false, "course choice is reported as not saved");
      await h.call("get_lesson_context", {});
      const attempt = await h.call("record_practice_attempt", { exercise_id: "dbb-01-daily-total", answer_text: "280" });
      h.check(ok(attempt) && attempt.saved === false, "practice is assessed but not saved");
      const cp = await h.call("save_checkpoint", {});
      h.check(ok(cp) && cp.saved === false, "checkpoint is reported as not saved");
      for (const table of LEARNER_TABLES) h.check((await h.count(table)) === 0, `nothing durable written to ${table}`);
      await h.call("close_learning_session", { reason: "learner_ended" });
      h.check(h.session.state.goal === null && h.session.state.courseId === null, "session state is cleared at close");
    },
  },
  {
    id: 9,
    title: "Learner asks what is remembered and corrects it",
    learner: { consent: "granted", language: "en-IN" },
    conversation: {
      learnerSays: ["What do you remember about me?", "Actually my goal is to sell blouses I stitch, not snacks.", "Use more examples please."],
      expectedBehaviour: ["Reads back what is saved, plainly.", "Confirms the correction before saving it.", "Never invents memories."],
    },
    async run(h) {
      await h.call("set_learning_goal", { goal_text: "Sell my homemade snacks", learner_confirmed: true });
      const before = await h.call("get_memory_summary");
      h.check(obj(field(before, "goal")).text === "Sell my homemade snacks", "memory summary returns the saved goal");
      const fix = await h.call("update_memory_preference", { key: "goal_text", value: "Sell the blouses I stitch", learner_confirmed: true });
      h.check(ok(fix) && fix.saved === true, "goal correction is saved");
      const style = await h.call("update_memory_preference", { key: "explanation_style", value: "examples", learner_confirmed: true });
      h.check(ok(style) && style.saved === true, "explanation-style preference is saved");
      const after = await h.call("get_memory_summary");
      h.check(obj(field(after, "goal")).text === "Sell the blouses I stitch", "the corrected goal replaces the old one");
      const prefs = field(after, "preferences");
      const pref = Array.isArray(prefs) ? obj(prefs.find((p) => obj(p).key === "explanation_style")) : {};
      h.check(pref.value === "examples" && pref.saved_from === "voice_session", "preference carries provenance");
      const unconfirmed = await h.call("update_memory_preference", { key: "pace", value: "slower" });
      h.check(!unconfirmed.ok, "corrections need the learner's confirmation");
    },
  },
  {
    id: 10,
    title: "Tool call times out or is repeated; no false success",
    learner: { consent: "granted", language: "en-IN" },
    conversation: {
      learnerSays: ["(network is slow while saving)", "Did that save?"],
      expectedBehaviour: ["If saved=false, says it could not save and does not claim success.", "A retried action is not duplicated."],
    },
    async run(h) {
      await h.call("start_or_resume_course", { course_id: "small-business-starter", learner_confirmed: true });
      await h.call("get_lesson_context", {});
      const args = { exercise_id: "sbs-01-offer-sentence", answer_text: "I make murukku for working families on my street" };
      const slow = await h.call("record_practice_attempt", args, { timeoutMs: 30, dbLatencyMs: 25 });
      h.check(!slow.ok && slow.saved === false && errorCode(slow) === "TIMEOUT", "a timed-out write reports saved=false");
      h.check(!slow.ok && /Do not tell the learner it was saved/.test(slow.guidance), "failure guidance tells the agent not to claim success");
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const retry = await h.call("record_practice_attempt", args);
      h.check(ok(retry), "the retry succeeds or replays the completed write");
      const again = await h.call("record_practice_attempt", args);
      h.check(ok(again) && again.replayed === true, "an identical repeat is replayed, not re-recorded");
      h.check((await h.count("practice_attempts")) === 1, "exactly one practice attempt is stored");
      await h.call("save_checkpoint", {});
      await h.call("save_checkpoint", {});
      h.check((await h.count("learning_checkpoints")) === 1, "a repeated checkpoint is stored once");
      const g1 = await h.call("set_learning_goal", { goal_text: "Price my snacks", learner_confirmed: true });
      const g2 = await h.call("set_learning_goal", { goal_text: "Price my snacks", learner_confirmed: true });
      h.check(ok(g1) && ok(g2) && (await h.count("learner_goals")) === 1, "a repeated goal is stored once");
    },
  },
  {
    id: 11,
    title: "A distinct second session resumes the correct lesson",
    learner: { consent: "granted", language: "en-IN" },
    conversation: {
      learnerSays: ["(new session) Where did we stop?"],
      expectedBehaviour: ["Summarises the remembered course and stopping point from the tool result.", "Asks whether to continue, review or change goal."],
    },
    async run(h) {
      await h.call("set_learning_goal", { goal_text: "Price my homemade snacks", learner_confirmed: true });
      await h.call("start_or_resume_course", { course_id: "small-business-starter", learner_confirmed: true });
      await h.call("get_lesson_context", {});
      await h.call("record_practice_attempt", { exercise_id: "sbs-01-offer-sentence", answer_text: "I make murukku for working families on my street" });
      const close = await h.call("close_learning_session", { reason: "learner_ended" });
      h.check(ok(close) && close.saved === true, "first session closes with a saved checkpoint");
      const firstSessionId = h.session.id;

      await h.newSession("phone");
      h.check(h.session.id !== firstSessionId, "the second session is a different session");
      const ctx = await h.call("get_learning_context");
      h.check(field(ctx, "active_goal") === "Price my homemade snacks", "the goal is remembered");
      h.check(obj(field(ctx, "active_course")).id === "small-business-starter", "the course is remembered");
      const progress = obj(field(ctx, "progress"));
      h.check(obj(progress.current_lesson).id === "sbs-01" && obj(progress.current_concept).id === "sbs-customer", "resumes at the next idea, not the beginning");
      h.check(typeof field(ctx, "last_session_summary") === "string", "a summary of the last session is available");
      h.check(field(ctx, "suggested_next_action") === "resume_lesson", "the suggested next action is to resume");
    },
  },
  {
    id: 12,
    title: "Provider connection fails or microphone permission is denied",
    learner: { consent: "granted", language: "en-IN" },
    conversation: {
      learnerSays: ["(browser blocks the microphone)", "(voice service unreachable)"],
      expectedBehaviour: ["The page shows a specific, recoverable error and offers the typed study room.", "No state is invented while disconnected."],
    },
    async run(h) {
      const denied = voiceReducer(voiceReducer(initialVoiceState, { type: "start_requested" }), {
        type: "failed",
        error: classifyVoiceError({ name: "NotAllowedError" }),
      });
      h.check(denied.phase === "error" && denied.error === "mic_denied", "microphone denial maps to a specific error state");
      h.check(classifyVoiceError({ name: "AuthenticationError", code: "AUTH", statusCode: 401 }) === "auth", "provider credential failures are recognised");
      h.check(classifyVoiceError({ name: "RateLimitError", code: "RATE", statusCode: 429 }) === "rate_limited", "provider rate limits are recognised");
      const afterError = voiceReducer(denied, { type: "sdk_state", state: "speaking" });
      h.check(afterError.phase === "error", "no 'speaking' state is shown after a failure");

      const config = evaluationConfig();
      const noAuth = await handleSarvamToolCallback(h.db, config, {
        authorization: null,
        toolName: "get_learning_context",
        body: { interaction_id: "x" },
        clientKey: `eval-${randomUUID()}`,
      });
      h.check(noAuth.status === 401, "a tool callback without credentials is rejected");
      const forged = await handleSarvamToolCallback(h.db, config, {
        authorization: `Bearer ${config.sarvam.toolSecretBrowser ?? ""}`,
        toolName: "get_learning_context",
        body: { interaction_id: `i-${randomUUID()}`, user_identifier: "lcv1.forged.signature" },
        clientKey: `eval-${randomUUID()}`,
      });
      h.check(forged.status === 401, "a forged voice-session identity is rejected");
    },
  },
];

let evalConfig: AppConfig | null = null;
/** Configuration used by scenario 12; set by the runner. */
export function setEvaluationConfig(config: AppConfig): void {
  evalConfig = config;
}
function evaluationConfig(): AppConfig {
  if (!evalConfig) throw new Error("Evaluation config not set");
  return evalConfig;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Simulate a slow database (e.g. a congested network) to exercise timeouts. */
function withLatency(db: Db, ms: number): Db {
  const slow = (q: Queryable): Queryable => ({
    async query(sql, params) {
      await sleep(ms);
      return q.query(sql, params);
    },
  });
  return {
    kind: db.kind,
    query: slow(db).query,
    transaction: (fn) => db.transaction((tx) => fn(slow(tx))),
    execScript: (sql) => db.execScript(sql),
    close: () => db.close(),
  };
}

export async function runScenario(db: Db, scenario: AgentScenario): Promise<ScenarioResult> {
  const failures: string[] = [];
  const { learner: created } = await learnerService.resolveOrCreate(db, { provider: "dev", subject: `eval-${randomUUID()}` }, { preferredLanguage: scenario.learner.language });
  let learner = scenario.learner.consent === "pending" ? created : await learnerService.recordConsent(db, created.id, scenario.learner.consent, "browser");
  let session = await sessionService.start(db, { learner, channel: "simulated", provider: "simulation" });

  const harness: Harness = {
    db,
    get learner() {
      return learner;
    },
    get session() {
      return session;
    },
    async call(tool, args = {}, opts = {}) {
      // Like the real adapters, each call starts from the persisted session.
      session = (await sessionsRepo.findById(db, session.id)) ?? session;
      const result = await runTool({
        db: opts.dbLatencyMs ? withLatency(db, opts.dbLatencyMs) : db,
        channel: session.channel,
        learner,
        session,
        toolName: tool,
        rawInput: args,
        interactionId: null,
        ...(opts.timeoutMs !== undefined ? { timeoutMs: opts.timeoutMs } : {}),
        ...(opts.idempotencyKey ? { idempotencyKey: opts.idempotencyKey } : {}),
      });
      if (result.session) session = result.session;
      if (result.learner) learner = result.learner;
      return result.response;
    },
    async newSession(channel = "simulated") {
      session = await sessionService.start(db, { learner, channel, provider: channel === "simulated" ? "simulation" : "sarvam" });
      return session;
    },
    check(condition, message) {
      if (!condition) failures.push(message);
    },
    async count(table) {
      if (!LEARNER_TABLES.has(table)) throw new Error(`count() is limited to learner tables, got ${table}`);
      const rows = await db.query(`select count(*)::int as n from ${table} where learner_id = $1`, [learner.id]);
      const n = obj(rows[0]).n;
      return typeof n === "number" ? n : Number(n);
    },
  };

  try {
    await scenario.run(harness);
  } catch (e) {
    failures.push(`threw: ${e instanceof Error ? e.message : String(e)}`);
  }
  return { id: scenario.id, title: scenario.title, passed: failures.length === 0, failures };
}

export async function runAllScenarios(db: Db, config: AppConfig): Promise<ScenarioResult[]> {
  setEvaluationConfig(config);
  const results: ScenarioResult[] = [];
  for (const scenario of AGENT_SCENARIOS) results.push(await runScenario(db, scenario));
  return results;
}

/** Conversation test cases for the provider's agent-testing tools. */
export function conversationCases(): Array<{ id: number; title: string } & ConversationCase> {
  return AGENT_SCENARIOS.map((s) => ({ id: s.id, title: s.title, ...s.conversation }));
}
