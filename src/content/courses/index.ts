import { courseSchema, type Course } from "../schema";
import { smallBusinessStarter } from "./small-business-starter";
import { digitalBusinessBasics } from "./digital-business-basics";
import { customerCommunication } from "./customer-communication";
import { customerCall } from "./customer-call";
import { withBusinessReviews } from "./business-reviews";

/**
 * The initial catalogue, validated at load. This is the seed source for the
 * `courses` and `course_lessons` tables; at runtime the services read course
 * knowledge from the database.
 */
export const COURSE_CATALOGUE: readonly Course[] = [
  smallBusinessStarter,
  digitalBusinessBasics,
  customerCommunication,
  customerCall,
].map((course) =>
  courseSchema.parse(course.id === "small-business-starter" ? withBusinessReviews(courseSchema.parse(course)) : course),
);
