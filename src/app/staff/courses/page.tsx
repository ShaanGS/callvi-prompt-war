import type { Metadata } from "next";
import Link from "next/link";
import { requireStaffPage } from "@/server/auth/actor";
import { getDb } from "@/server/db/client";
import { staffCourses } from "@/server/services/staff-service";
import { PageHeader, Tag } from "@/components/ui/primitives";
import { EmptyRow, Table, Td, Th } from "@/components/staff/table";

export const metadata: Metadata = { title: "Courses" };

const REVIEW_LABEL: Record<string, string> = {
  team_authored: "Team-authored",
  mentor_review_in_progress: "Mentor review in progress",
  mentor_reviewed: "Mentor-reviewed",
};

export default async function StaffCoursesPage() {
  await requireStaffPage();
  const courses = await staffCourses(await getDb());
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Courses"
        lead="Catalogue, review status and real learner activity per course. Content is edited in src/content/courses and re-seeded with npm run db:seed."
      />
      <Table caption="Courses">
        <thead>
          <tr>
            <Th>Course</Th>
            <Th>Status</Th>
            <Th>Content review</Th>
            <Th numeric>Lessons</Th>
            <Th numeric>Flagged lessons</Th>
            <Th numeric>Version</Th>
            <Th numeric>Enrolments</Th>
            <Th numeric>Completed</Th>
            <Th numeric>Attempts</Th>
            <Th numeric>Needs practice</Th>
          </tr>
        </thead>
        <tbody>
          {courses.length === 0 ? (
            <EmptyRow colSpan={10}>No courses in the database. Run npm run db:seed.</EmptyRow>
          ) : null}
          {courses.map((c) => (
            <tr key={c.id}>
              <Td>
                <Link href={`/courses/${c.id}`} className="font-medium text-accent underline-offset-4 hover:underline">
                  {c.title}
                </Link>
                <div className="font-mono text-xs text-subtle">{c.id}</div>
              </Td>
              <Td>
                <Tag tone={c.status === "published" ? "success" : "neutral"}>{c.status}</Tag>
              </Td>
              <Td>{REVIEW_LABEL[c.reviewStatus] ?? c.reviewStatus}</Td>
              <Td numeric>{c.lessons}</Td>
              <Td numeric>{c.flaggedLessons}</Td>
              <Td numeric>{c.contentVersion}</Td>
              <Td numeric>{c.enrollments}</Td>
              <Td numeric>{c.completed}</Td>
              <Td numeric>{c.attempts}</Td>
              <Td numeric>{c.needsPractice}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
