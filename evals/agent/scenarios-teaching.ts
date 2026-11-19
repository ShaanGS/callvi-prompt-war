import { courseService, findExercise } from "@/server/services/course-service";
import { assessAnswer } from "@/lib/assessment/assessment-service";
import { agentInstructions } from "@/server/providers/sarvam/agent-setup";
import type { AgentScenario } from "./types";
import { SHAMING, TAMIL, ok, errorCode, field, obj } from "./checks";

/** Scenarios 1-7: goals, courses, explanations, practice, language and scope. */

export const TEACHING_SCENARIOS: AgentScenario[] = [
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
      h.check(
        field(ctx, "suggested_next_action") === "discover_goal",
        "context suggests goal discovery when there is no goal",
      );
      const list = await h.call("list_courses", {});
      const recIds = field(list, "recommended_course_ids");
      h.check(ok(list) && Array.isArray(recIds) && recIds.length === 0, "no recommendation is forced without a goal");
      const unconfirmed = await h.call("set_learning_goal", { goal_text: "earn from home" });
      h.check(
        errorCode(unconfirmed) === "VALIDATION" && !unconfirmed.ok && unconfirmed.saved === false,
        "a goal is not saved without learner confirmation",
      );
      h.check((await h.count("learner_goals")) === 0, "no goal row was written");
    },
  },
  {
    id: 2,
    title: "Learner chooses Small Business Starter and confirms a goal",
    learner: { consent: "granted", language: "en-IN" },
    conversation: {
      learnerSays: [
        "I make murukku at home and want to sell it properly.",
        "Yes, that's right.",
        "The small business one.",
      ],
      expectedBehaviour: [
        "Restates and confirms the goal.",
        "Offers at most three courses with a reason.",
        "Enrols only after the learner chooses.",
      ],
    },
    async run(h) {
      const goal = await h.call("set_learning_goal", {
        goal_text: "Sell my homemade murukku and price it properly",
        learner_confirmed: true,
      });
      h.check(ok(goal) && goal.saved === true, "confirmed goal is saved");
      const list = await h.call("list_courses", {});
      const recommended = field(list, "recommended_course_ids");
      h.check(
        Array.isArray(recommended) && recommended[0] === "small-business-starter",
        "Small Business Starter is recommended first for this goal",
      );
      const noConfirm = await h.call("start_or_resume_course", { course_id: "small-business-starter" });
      h.check(!noConfirm.ok, "enrolment requires the learner's explicit choice");
      const enrol = await h.call("start_or_resume_course", {
        course_id: "small-business-starter",
        learner_confirmed: true,
      });
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
      expectedBehaviour: [
        "Uses a different teaching approach, not the same words again.",
        "Keeps to the course's facts.",
      ],
    },
    async run(h) {
      await h.call("start_or_resume_course", { course_id: "small-business-starter", learner_confirmed: true });
      const first = await h.call("get_lesson_context", {});
      const second = await h.call("get_lesson_context", { request: "different_explanation" });
      const a1 = obj(field(first, "explanation_status")).approach;
      const a2 = obj(field(second, "explanation_status")).approach;
      h.check(
        typeof a1 === "string" && typeof a2 === "string" && a1 !== a2,
        "a different explanation uses a different approach",
      );
      h.check(
        obj(field(first, "concept")).explanation !== obj(field(second, "concept")).explanation,
        "the explanation text changes",
      );
      h.check(
        obj(field(first, "concept")).id === obj(field(second, "concept")).id,
        "the idea being taught stays the same",
      );
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
      h.check(
        obj(field(back, "concept")).id === obj(field(before, "concept")).id,
        "the learner's place is unchanged after the interruption",
      );
      h.check(h.session.state.lessonId === "sbs-01", "session state still points at lesson 1");
    },
  },
  {
    id: 5,
    title: "Partially correct and incorrect practice answers",
    learner: { consent: "granted", language: "en-IN" },
    conversation: {
      learnerSays: ["I sell snacks.", "(for the unit-cost question) 120 rupees"],
      expectedBehaviour: [
        "Says what was right and what is missing.",
        "Explains the likely slip in the calculation without shaming.",
        "Offers a retry or a different explanation.",
      ],
    },
    async run(h) {
      await h.call("start_or_resume_course", { course_id: "small-business-starter", learner_confirmed: true });
      await h.call("get_lesson_context", {});
      const partial = await h.call("record_practice_attempt", {
        exercise_id: "sbs-01-offer-sentence",
        answer_text: "I sell snacks",
      });
      const r1 = field(partial, "result");
      h.check(
        r1 === "partial" || r1 === "needs_practice",
        `an incomplete answer is not marked correct (got ${String(r1)})`,
      );
      h.check(
        typeof field(partial, "feedback") === "string" && !SHAMING.test(String(field(partial, "feedback"))),
        "feedback contains no shaming language",
      );
      h.check(field(partial, "next_step") === "retry", "first miss offers a retry");
      const second = await h.call("record_practice_attempt", {
        exercise_id: "sbs-01-offer-sentence",
        answer_text: "snacks",
      });
      h.check(field(second, "next_step") === "offer_move_on", "after two misses the learner may move on");
      h.check(
        typeof field(second, "model_answer") === "string",
        "the example answer is shown after the second attempt",
      );

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
      const sw = await h.call("update_memory_preference", {
        key: "preferred_language",
        value: "English",
        learner_confirmed: true,
      });
      h.check(ok(sw) && sw.saved === true, "language switch is saved for a consenting learner");
      const en = await h.call("get_lesson_context", { request: "repeat" });
      h.check(
        !TAMIL.test(String(obj(field(en, "concept")).explanation)),
        "lesson content is returned in English after switching",
      );
      const bad = await h.call("update_memory_preference", {
        key: "preferred_language",
        value: "Hindi",
        learner_confirmed: true,
      });
      h.check(errorCode(bad) === "VALIDATION", "unsupported languages are refused");

      const course = await courseService.getAvailable(h.db, "small-business-starter");
      const { exercise } = findExercise(course, "sbs-02-unit-cost");
      const tamilNumber = assessAnswer({
        exercise,
        answerText: "ஒரு முறுக்குக்கு பன்னிரண்டு ரூபாய்",
        language: "ta-IN",
        attemptNumber: 1,
      });
      h.check(tamilNumber.result === "correct", "a Tamil number word is understood in a numeric answer");
    },
  },
  {
    id: 7,
    title: "Question outside the course scope",
    learner: { consent: "granted", language: "en-IN" },
    conversation: {
      learnerSays: ["Which bank gives the cheapest loan?", "Can you guarantee I'll make money?"],
      expectedBehaviour: [
        "Says honestly this is outside the course.",
        "Does not give loan advice or promise income.",
        "Offers to return to the lesson.",
      ],
    },
    async run(h) {
      await h.call("start_or_resume_course", { course_id: "small-business-starter", learner_confirmed: true });
      const other = await h.call("get_lesson_context", { lesson_id: "dbb-01" });
      h.check(!other.ok, "content from another course is not served inside this course");
      const foreign = await h.call("record_practice_attempt", {
        exercise_id: "dbb-01-daily-total",
        answer_text: "280",
      });
      h.check(!foreign.ok && foreign.saved === false, "practice from another course is not recorded");
      const prompt = agentInstructions("browser");
      h.check(
        /regulated financial advice/.test(prompt) && /Never promise income/.test(prompt),
        "agent instructions state the scope limits",
      );
    },
  },
];
