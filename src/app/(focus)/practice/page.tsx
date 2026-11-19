import { getPageContext } from "@/server/auth/page-context";
import { SkillPreview } from "./skill-preview";

export default async function PracticePage({
  searchParams,
}: {
  searchParams: Promise<{ skill?: string; lang?: string }>;
}) {
  const [{ language }, query] = await Promise.all([getPageContext(), searchParams]);
  const selected = query.lang === "ta" ? "ta-IN" : query.lang === "en" ? "en-IN" : language;
  return <SkillPreview key={query.skill ?? ""} skill={query.skill ?? ""} language={selected} />;
}
