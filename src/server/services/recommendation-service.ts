import type { LanguageCode } from "@/lib/languages";
import type { StoredCourse } from "../repositories/courses";
import { normaliseAnswer, termMatches } from "@/lib/assessment/text";

/**
 * Recommend courses for a stated goal by matching the goal against each
 * course's curated recommendation terms (Tamil and English, so code-mixed
 * goals still match). Transparent and deterministic: the learner always
 * chooses; no match means "ask a clarifying question", not a forced pick.
 */
export interface CourseRecommendation {
  courseId: string;
  score: number;
  matchedTerms: string[];
}

export function recommendCourses(courses: StoredCourse[], goalText: string, max = 3): CourseRecommendation[] {
  const goal = normaliseAnswer(goalText);
  if (goal.length === 0) return [];
  return courses
    .map((course) => {
      const all = [...course.recommendationTerms["en-IN"], ...course.recommendationTerms["ta-IN"]];
      const matchedTerms = Array.from(new Set(all.filter((t) => termMatches(goal, t))));
      return { courseId: course.id, score: matchedTerms.length, matchedTerms, sortOrder: course.sortOrder };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.sortOrder - b.sortOrder)
    .slice(0, max)
    .map(({ courseId, score, matchedTerms }) => ({ courseId, score, matchedTerms }));
}

export function describeRecommendationReason(rec: CourseRecommendation, language: LanguageCode): string {
  const words = rec.matchedTerms.slice(0, 3).join(", ");
  return language === "ta-IN" ? `உங்கள் இலக்கில் உள்ள சொற்களுடன் பொருந்துகிறது: ${words}` : `Matches words in your goal: ${words}`;
}
