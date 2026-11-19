import type { RegisteredTool } from "./tool-types";
import { closeLearningSession, saveCheckpoint } from "./tools/session";
import { getLearningContext, setLearningGoal, setMemoryConsent } from "./tools/learner";
import { getLessonContext } from "./tools/lesson";
import { getMemorySummary, requestDataDeletion, updateMemoryPreference } from "./tools/memory";
import { listCourses, startOrResumeCourse } from "./tools/courses";
import { recordPracticeAttempt } from "./tools/practice";

/**
 * The learning tool surface. Each tool is a narrow, typed operation over the
 * application's services. Handlers never trust the voice model for facts:
 * course content comes from the database, assessment from the rubric, and
 * checkpoints from session state.
 *
 * Each tool lives with the others in its area under ./tools; this list is
 * the order they are offered to the agent.
 */
export const TOOLS: readonly RegisteredTool[] = [
  getLearningContext,
  setMemoryConsent,
  listCourses,
  setLearningGoal,
  startOrResumeCourse,
  getLessonContext,
  recordPracticeAttempt,
  saveCheckpoint,
  closeLearningSession,
  getMemorySummary,
  updateMemoryPreference,
  requestDataDeletion,
];
