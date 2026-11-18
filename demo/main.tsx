import { createRoot } from "react-dom/client";
import "@fontsource/noto-sans-tamil/tamil-400.css";
import { PracticeReply } from "../src/app/(focus)/practice/practice-reply";
import { customerCall } from "../src/content/courses/customer-call";
import { exerciseSchema } from "../src/content/schema";

const exercise = exerciseSchema.parse(customerCall.lessons[0].practice[0]);
const language = new URLSearchParams(location.search).get("lang") === "ta" ? "ta-IN" : "en-IN";
createRoot(document.getElementById("root")!).render(
  <PracticeReply exercise={exercise} language={language} assets="./rehearsal" />
);
