import { ClipboardCheck, PenLine } from "lucide-react";
import type { Messages } from "@/lib/i18n";
import { Tag } from "@/components/ui/primitives";

type ReviewStatus = "team_authored" | "mentor_review_in_progress" | "mentor_reviewed";

/** Truthful content-review label. Never implies certification. */
export function ReviewStatusTag({ status, t }: { status: ReviewStatus; t: Messages }) {
  const tone = status === "mentor_reviewed" ? "success" : status === "mentor_review_in_progress" ? "info" : "neutral";
  const icon = status === "mentor_reviewed" ? <ClipboardCheck aria-hidden className="size-3.5" /> : <PenLine aria-hidden className="size-3.5" />;
  return (
    <Tag tone={tone} icon={icon}>
      {t.review[status]}
    </Tag>
  );
}
