import { z } from "zod";
import { col, jsonParam, many, type Queryable } from "../db/types";
import { PRACTICE_RESULTS } from "../domain/types";

export const supportSchema = z.enum(["none_recorded", "explanation_provided", "hint_provided", "example_provided"]);
export type PracticeSupport = z.infer<typeof supportSchema>;
const evidenceRow = z.object({
  attempt_id: col.uuid, learner_id: col.uuid, enrollment_id: col.uuid,
  session_id: col.uuid.nullable(), lesson_id: col.text, concept_id: col.text, exercise_id: col.text,
  purpose: z.enum(["practice", "review"]), result: z.enum(PRACTICE_RESULTS), support: supportSchema,
  approach: col.nullableText, met_criteria: z.array(z.string()), missed_criteria: z.array(z.string()),
  rubric_version: col.int, observed_at: col.date,
});
export type LearningEvidence = z.infer<typeof evidenceRow>;

export const evidenceRepo = {
  async insert(db: Queryable, row: Omit<LearningEvidence, "observed_at">): Promise<void> {
    await db.query(`insert into learning_evidence
      (attempt_id,learner_id,enrollment_id,session_id,lesson_id,concept_id,exercise_id,purpose,result,support,approach,met_criteria,missed_criteria,rubric_version)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb,$14) on conflict (attempt_id) do nothing`,
      [row.attempt_id,row.learner_id,row.enrollment_id,row.session_id,row.lesson_id,row.concept_id,row.exercise_id,row.purpose,row.result,row.support,row.approach,jsonParam(row.met_criteria),jsonParam(row.missed_criteria),row.rubric_version]);
  },
  async list(db: Queryable, learnerId: string, enrollmentId: string): Promise<LearningEvidence[]> {
    // A bounded history per idea prevents a long course from crowding out others.
    return many(db, evidenceRow, `select * from (
      select *, row_number() over (partition by concept_id order by observed_at desc, attempt_id desc) as position
      from learning_evidence where learner_id=$1 and enrollment_id=$2
    ) recent where position <= 12 order by observed_at desc, attempt_id desc`, [learnerId, enrollmentId]);
  },
};
