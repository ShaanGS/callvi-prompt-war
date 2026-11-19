import { randomUUID } from "node:crypto";
import { classifyVoiceError, initialVoiceState, voiceReducer } from "@/lib/voice/voice-state";

import { handleSarvamToolCallback } from "@/server/providers/sarvam/tool-callback";
import type { AgentScenario } from "./types";
import { LEARNER_TABLES, ok, errorCode, field, obj } from "./checks";
import { evaluationConfig } from "./config";

/** Scenarios 8-12: memory consent, recall and correction, timeouts, resuming, and provider failures. */

export const MEMORY_AND_FAILURE_SCENARIOS: AgentScenario[] = [
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
      const goal = await h.call("set_learning_goal", {
        goal_text: "Learn to keep sales records",
        learner_confirmed: true,
      });
      h.check(ok(goal) && goal.saved === false, "goal is kept for the session but reported as not saved");
      const enrol = await h.call("start_or_resume_course", {
        course_id: "digital-business-basics",
        learner_confirmed: true,
      });
      h.check(ok(enrol) && enrol.saved === false, "course choice is reported as not saved");
      await h.call("get_lesson_context", {});
      const attempt = await h.call("record_practice_attempt", {
        exercise_id: "dbb-01-daily-total",
        answer_text: "280",
      });
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
      learnerSays: [
        "What do you remember about me?",
        "Actually my goal is to sell blouses I stitch, not snacks.",
        "Use more examples please.",
      ],
      expectedBehaviour: [
        "Reads back what is saved, plainly.",
        "Confirms the correction before saving it.",
        "Never invents memories.",
      ],
    },
    async run(h) {
      await h.call("set_learning_goal", { goal_text: "Sell my homemade snacks", learner_confirmed: true });
      const before = await h.call("get_memory_summary");
      h.check(obj(field(before, "goal")).text === "Sell my homemade snacks", "memory summary returns the saved goal");
      const fix = await h.call("update_memory_preference", {
        key: "goal_text",
        value: "Sell the blouses I stitch",
        learner_confirmed: true,
      });
      h.check(ok(fix) && fix.saved === true, "goal correction is saved");
      const style = await h.call("update_memory_preference", {
        key: "explanation_style",
        value: "examples",
        learner_confirmed: true,
      });
      h.check(ok(style) && style.saved === true, "explanation-style preference is saved");
      const after = await h.call("get_memory_summary");
      h.check(
        obj(field(after, "goal")).text === "Sell the blouses I stitch",
        "the corrected goal replaces the old one",
      );
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
      expectedBehaviour: [
        "If saved=false, says it could not save and does not claim success.",
        "A retried action is not duplicated.",
      ],
    },
    async run(h) {
      await h.call("start_or_resume_course", { course_id: "small-business-starter", learner_confirmed: true });
      await h.call("get_lesson_context", {});
      const args = {
        exercise_id: "sbs-01-offer-sentence",
        answer_text: "I make murukku for working families on my street",
      };
      const slow = await h.call("record_practice_attempt", args, { timeoutMs: 30, dbLatencyMs: 25 });
      h.check(
        !slow.ok && slow.saved === false && errorCode(slow) === "TIMEOUT",
        "a timed-out write reports saved=false",
      );
      h.check(
        !slow.ok && /Do not tell the learner it was saved/.test(slow.guidance),
        "failure guidance tells the agent not to claim success",
      );
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
      expectedBehaviour: [
        "Summarises the remembered course and stopping point from the tool result.",
        "Asks whether to continue, review or change goal.",
      ],
    },
    async run(h) {
      await h.call("set_learning_goal", { goal_text: "Price my homemade snacks", learner_confirmed: true });
      await h.call("start_or_resume_course", { course_id: "small-business-starter", learner_confirmed: true });
      await h.call("get_lesson_context", {});
      await h.call("record_practice_attempt", {
        exercise_id: "sbs-01-offer-sentence",
        answer_text: "I make murukku for working families on my street",
      });
      const close = await h.call("close_learning_session", { reason: "learner_ended" });
      h.check(ok(close) && close.saved === true, "first session closes with a saved checkpoint");
      const firstSessionId = h.session.id;

      await h.newSession("phone");
      h.check(h.session.id !== firstSessionId, "the second session is a different session");
      const ctx = await h.call("get_learning_context");
      h.check(field(ctx, "active_goal") === "Price my homemade snacks", "the goal is remembered");
      h.check(obj(field(ctx, "active_course")).id === "small-business-starter", "the course is remembered");
      const progress = obj(field(ctx, "progress"));
      h.check(
        obj(progress.current_lesson).id === "sbs-01" && obj(progress.current_concept).id === "sbs-customer",
        "resumes at the next idea, not the beginning",
      );
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
      expectedBehaviour: [
        "The page shows a specific, recoverable error and offers the typed study room.",
        "No state is invented while disconnected.",
      ],
    },
    async run(h) {
      const denied = voiceReducer(voiceReducer(initialVoiceState, { type: "start_requested" }), {
        type: "failed",
        error: classifyVoiceError({ name: "NotAllowedError" }),
      });
      h.check(
        denied.phase === "error" && denied.error === "mic_denied",
        "microphone denial maps to a specific error state",
      );
      h.check(
        classifyVoiceError({ name: "AuthenticationError", code: "AUTH", statusCode: 401 }) === "auth",
        "provider credential failures are recognised",
      );
      h.check(
        classifyVoiceError({ name: "RateLimitError", code: "RATE", statusCode: 429 }) === "rate_limited",
        "provider rate limits are recognised",
      );
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
