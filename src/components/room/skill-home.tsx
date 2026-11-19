import { ArrowUpRight, AudioLines, Calculator, Fingerprint, MessageCircle } from "lucide-react";
import type { ReactNode } from "react";
import type { LanguageCode } from "@/lib/languages";
import { voiceCopy } from "@/lib/voice/copy";
import { VoiceOrb } from "./voice-orb";
import styles from "./voice-entry.module.css";
import "./skill-home.css";

export const paths = [
  {
    id: "cost",
    icon: Calculator,
    en: ["Small business", "Work out the cost of one packet."],
    ta: ["சிறு தொழில்", "ஒரு பொட்டலத்தின் செலவைக் கணக்கிடுங்கள்."],
  },
  {
    id: "digital",
    icon: Fingerprint,
    en: ["Digital skills", "Check whether a payment arrived."],
    ta: ["டிஜிட்டல் திறன்கள்", "பணம் வந்ததா என்று சரிபாருங்கள்."],
  },
  {
    id: "communication",
    icon: MessageCircle,
    en: ["Communication", "Explain a price and a pickup time."],
    ta: ["உரையாடல் திறன்கள்", "கூலியையும் முடிக்கும் நேரத்தையும் சொல்லுங்கள்."],
  },
] as const;

export function SkillHome({
  language,
  lessonHref,
  children,
  languageControl,
}: {
  language: LanguageCode;
  lessonHref: (id: string) => string;
  children: ReactNode;
  languageControl?: ReactNode;
}) {
  const text = voiceCopy(language);
  const tamil = language === "ta-IN";
  return (
    <>
      <section className="skill-intro" id="start-learning" lang={tamil ? "ta" : "en"}>
        <div className="skill-intro-copy">
          <p className="skill-overline">
            <AudioLines size={18} aria-hidden />
            {text.eyebrow}
          </p>
          <h1>{text.title}</h1>
          <p className="skill-body">{text.body}</p>
          <div className="skill-actions">{children}</div>
        </div>
        <div className={styles.voiceStage + " skill-visual"} aria-hidden="true">
          <div className={styles.stageTexture} />
          <VoiceOrb className="skill-orb" />
          <div className="skill-wave">
            {[8, 15, 8, 22, 34, 18, 40, 56, 24, 36, 16, 26, 42, 64, 34, 50, 18, 32, 20, 12, 23, 10, 6].map(
              (height, i) => (
                <i key={i} style={{ height }} />
              ),
            )}
          </div>
        </div>
      </section>
      <section className="skill-paths" id="skills">
        <header>
          <h2>{tamil ? "என்ன கற்க விரும்புகிறீர்கள்?" : "What would you like to learn?"}</h2>
          {languageControl}
        </header>
        <div className="skill-choices">
          {paths.map((path) => {
            const [title, description] = tamil ? path.ta : path.en;
            return (
              <a key={path.id} href={lessonHref(path.id)}>
                <span className="skill-icon">
                  <path.icon size={21} strokeWidth={1.6} aria-hidden />
                </span>
                <span>
                  <strong>{title}</strong>
                  <small>{description}</small>
                </span>
                <ArrowUpRight size={17} aria-hidden />
              </a>
            );
          })}
        </div>
      </section>
    </>
  );
}
