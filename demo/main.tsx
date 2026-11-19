import { createRoot } from "react-dom/client";
import "@fontsource/noto-sans-tamil/tamil-400.css";
import "./base.css";
import { SkillPreview } from "../src/app/(focus)/practice/skill-preview";

const query = new URLSearchParams(location.search);
createRoot(document.getElementById("root")!).render(
  <SkillPreview
    language={query.get("lang") === "ta" ? "ta-IN" : "en-IN"}
    skill={query.get("skill") ?? ""}
    standalone
  />,
);
