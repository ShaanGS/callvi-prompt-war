import { getPageContext } from "@/server/auth/page-context";
import { customerCall } from "@/content/courses/customer-call";
import { exerciseSchema } from "@/content/schema";
import { PracticeReply } from "./practice-reply";

export default async function PracticePage() {
  const { language } = await getPageContext();
  return <PracticeReply exercise={exerciseSchema.parse(customerCall.lessons[0].practice[0])} language={language} homeHref="/" />;
}
