import Link from "next/link";
import { getPageContext } from "@/server/auth/page-context";
import { customerCall } from "@/content/courses/customer-call";
import { exerciseSchema } from "@/content/schema";
import { PracticeReply } from "./practice-reply";

export default async function PracticePage() {
  const { language } = await getPageContext();
  const tamil = language === "ta-IN";
  const exercise = exerciseSchema.parse(customerCall.lessons[0].practice[0]);
  return <main id="main" className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-12">
    <Link className="underline" href="/">{tamil ? "கால்விக்குத் திரும்பு" : "Back to Callvi"}</Link>
    <h1 className="text-3xl font-semibold">{customerCall.title[language]}</h1>
    <p>{exercise.prompt[language]}</p>
    <PracticeReply exercise={exercise} language={language} />
  </main>;
}
