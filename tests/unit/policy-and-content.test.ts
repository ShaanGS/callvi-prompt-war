import { describe, expect, it } from "vitest";
import { COURSE_CATALOGUE } from "@/content/courses";
import { courseSchema } from "@/content/schema";
import {
  canCarryForward,
  canOpenLesson,
  chooseExplanation,
  frontierLesson,
  isLessonComplete,
  masteryAfterAttempt,
  nextStepAfterAttempt,
  suggestNextAction,
} from "@/server/agent/learning-policy";
import { recommendCourses } from "@/server/services/recommendation-service";
import type { StoredCourse } from "@/server/repositories/courses";

const sbs = COURSE_CATALOGUE.find((c) => c.id === "small-business-starter")!;
const stored: StoredCourse[] = COURSE_CATALOGUE.map((c) => ({ ...c, contentVersion: 1, updatedAt: new Date() }));

describe("course content", () => {
  it("has four valid courses, each with distinct explanation approaches and practice for every idea", () => {
    expect(COURSE_CATALOGUE).toHaveLength(4);
    for (const course of COURSE_CATALOGUE) {
      expect(courseSchema.safeParse(course).success).toBe(true);
      for (const lesson of course.lessons) {
        for (const concept of lesson.concepts) {
          expect(concept.explanations.length).toBeGreaterThanOrEqual(2);
          expect(lesson.practice.some((p) => p.conceptId === concept.id)).toBe(true);
          for (const e of concept.explanations) {
            expect(e.text["en-IN"].length).toBeGreaterThan(0);
            expect(e.text["ta-IN"].length).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  it("never labels content as expert-reviewed unless it is", () => {
    for (const course of COURSE_CATALOGUE) expect(course.contentReview.status).not.toBe("mentor_reviewed");
  });

  it("rejects a course whose lesson sequence has a gap", () => {
    const broken = { ...sbs, lessons: sbs.lessons.map((l) => (l.sequence === 2 ? { ...l, sequence: 5 } : l)) };
    expect(courseSchema.safeParse(broken).success).toBe(false);
  });
});

describe("progression respects lesson order and completion", () => {
  it("only the first lesson is open at the start", () => {
    const none = new Set<string>();
    expect(frontierLesson(sbs, none).id).toBe("sbs-01");
    expect(canOpenLesson(sbs, none, "sbs-01").allowed).toBe(true);
    expect(canOpenLesson(sbs, none, "sbs-02").allowed).toBe(false);
    expect(canOpenLesson(sbs, none, "sbs-03").allowed).toBe(false);
  });

  it("completing a lesson opens the next one, and completed lessons stay reviewable", () => {
    const done = new Set(["sbs-01"]);
    expect(frontierLesson(sbs, done).id).toBe("sbs-02");
    expect(canOpenLesson(sbs, done, "sbs-02").allowed).toBe(true);
    expect(canOpenLesson(sbs, done, "sbs-01").allowed).toBe(true);
    expect(canOpenLesson(sbs, done, "sbs-03").allowed).toBe(false);
  });

  it("a lesson is complete only when every idea is mastered or carried forward", () => {
    const lesson = sbs.lessons[0];
    const ids = lesson.concepts.map((c) => c.id);
    expect(isLessonComplete(lesson, { [ids[0]]: "mastered", [ids[1]]: "mastered" })).toBe(false);
    expect(isLessonComplete(lesson, { [ids[0]]: "mastered", [ids[1]]: "carried_forward", [ids[2]]: "mastered" })).toBe(true);
    expect(isLessonComplete(lesson, { [ids[0]]: "mastered", [ids[1]]: "practising", [ids[2]]: "mastered" })).toBe(false);
  });
});

describe("practice policy", () => {
  it("records successful practice without claiming retained mastery", () => {
    expect(masteryAfterAttempt(undefined, "correct")).toBe("practised");
    expect(masteryAfterAttempt(undefined, "partial")).toBe("practising");
    expect(masteryAfterAttempt("mastered", "needs_practice")).toBe("mastered");
    expect(masteryAfterAttempt(undefined, "ungraded")).toBe("practising");
  });

  it("offers retry, then a choice to move on; ungraded asks for self-check", () => {
    expect(nextStepAfterAttempt({ result: "partial", attemptsOnConcept: 1, lessonComplete: false, courseComplete: false })).toBe("retry");
    expect(nextStepAfterAttempt({ result: "needs_practice", attemptsOnConcept: 2, lessonComplete: false, courseComplete: false })).toBe("offer_move_on");
    expect(nextStepAfterAttempt({ result: "ungraded", attemptsOnConcept: 1, lessonComplete: false, courseComplete: false })).toBe("self_check");
    expect(nextStepAfterAttempt({ result: "correct", attemptsOnConcept: 1, lessonComplete: true, courseComplete: false })).toBe("lesson_complete");
    expect(canCarryForward(0, undefined)).toBe(false);
    expect(canCarryForward(1, "practising")).toBe(true);
    expect(canCarryForward(3, "mastered")).toBe(false);
  });

  it("chooses an unused approach for a different explanation and flags exhaustion", () => {
    const concept = sbs.lessons[0].concepts[0];
    const first = chooseExplanation(concept, [], "different");
    const second = chooseExplanation(concept, [first.approach], "different");
    expect(second.approach).not.toBe(first.approach);
    const all = concept.explanations.map((e) => e.approach);
    expect(chooseExplanation(concept, all, "different").exhausted).toBe(true);
    expect(chooseExplanation(concept, [first.approach], "repeat").approach).toBe(first.approach);
  });

  it("prefers the learner's explanation style when available", () => {
    const concept = sbs.lessons[0].concepts[0];
    const choice = chooseExplanation(concept, [], "different", "examples");
    if (concept.explanations.some((e) => e.approach === "everyday_example" || e.approach === "analogy")) {
      expect(["everyday_example", "analogy"]).toContain(choice.approach);
    }
  });
});

describe("next action and recommendations", () => {
  it("asks for consent first, then a goal, then a course", () => {
    expect(suggestNextAction({ consentStatus: "pending", hasGoal: false, hasActiveCourse: false, courseComplete: false, hasCheckpoint: false })).toBe("ask_memory_consent");
    expect(suggestNextAction({ consentStatus: "granted", hasGoal: false, hasActiveCourse: false, courseComplete: false, hasCheckpoint: false })).toBe("discover_goal");
    expect(suggestNextAction({ consentStatus: "declined", hasGoal: true, hasActiveCourse: false, courseComplete: false, hasCheckpoint: false })).toBe("recommend_course");
  });

  it("recommends matching courses from English and Tamil goals, and nothing for unrelated goals", () => {
    expect(recommendCourses(stored, "I want to price my homemade snacks")[0]?.courseId).toBe("small-business-starter");
    expect(recommendCourses(stored, "வீட்டுல முறுக்கு செஞ்சு விக்க கத்துக்கணும்")[0]?.courseId).toBe("small-business-starter");
    expect(recommendCourses(stored, "keep a record of daily sales in a notebook")[0]?.courseId).toBe("digital-business-basics");
    expect(recommendCourses(stored, "வாடிக்கையாளர்களிடம் பேச")[0]?.courseId).toBe("customer-communication");
    expect(recommendCourses(stored, "astronomy and telescopes")).toEqual([]);
  });
});
