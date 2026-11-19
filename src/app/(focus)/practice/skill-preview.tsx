"use client";

import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, AudioLines, Headphones } from "lucide-react";
import { getSkillPreview } from "@/content/skill-preview";
import { customerCall } from "@/content/courses/customer-call";
import { exerciseSchema } from "@/content/schema";
import { assessAnswer } from "@/server/services/assessment/assessment-service";
import { voiceCopy } from "@/lib/voice/copy";
import type { LanguageCode } from "@/lib/languages";
import { SkillHome } from "@/components/room/skill-home";
import styles from "@/components/room/voice-entry.module.css";
import { PracticeReply } from "./practice-reply";
import { AudioPrompt } from "./audio-prompt";

const tailoring = exerciseSchema.parse(customerCall.lessons[0].practice[0]);

export function SkillPreview({ language: initial, skill, standalone = false }: {
  language: LanguageCode; skill: string; standalone?: boolean;
}) {
  const [language, setLanguage] = useState(initial);
  const tamil = language === "ta-IN";
  const text = voiceCopy(language);
  const assets = standalone ? "./rehearsal" : "/rehearsal";
  const home = (standalone ? "./" : "/") + (standalone && tamil ? "?lang=ta" : "");
  const link = (id: string) => (standalone ? "./" : "/practice") + "?skill=" + id + "&lang=" + (tamil ? "ta" : "en");
  const preview = getSkillPreview(skill);
  const [reply, setReply] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [checked, setChecked] = useState("");
  const [explanation, setExplanation] = useState(0);
  const result = preview && attempt ? assessAnswer({ exercise: preview.exercise, language, answerText: checked, attemptNumber: attempt }) : null;
  const playing = useRef<HTMLAudioElement | null>(null);
  const languageControl = <div className={styles.languagePill} aria-label={text.language}>
    {(["ta-IN", "en-IN"] as const).map(code => <button type="button" key={code} className={language === code ? styles.selectedLanguage : ""} aria-pressed={language === code} onClick={() => { playing.current?.pause(); setLanguage(code); }}>{code === "ta-IN" ? "தமிழ்" : "English"}</button>)}
  </div>;

  if (skill === "communication") return <PracticeReply exercise={tailoring} language={language} assets={assets} homeHref={home} />;
  return <div className={styles.landing} lang={tamil ? "ta" : "en"}><div className={styles.pageFrame}>
    <header className={styles.header}><a className={styles.wordmark} href={home} aria-label="Callvi"><AudioLines aria-hidden />callvi</a>
      <div className={styles.headerActions}>{languageControl}</div></header>
    <main className={styles.main} id="main">{preview ? <div className="cv-reader">
      <a href={home + "#skills"} className="cv-back"><ArrowLeft size={16} />{tamil ? "திறன்கள்" : "All skills"}</a>
      <p className="skill-overline">{preview.course[language]}</p><h1>{preview.concept.title[language]}</h1>
      <section className="cv-concept"><p>{preview.concept.explanations[explanation].text[language]}</p>
        <button type="button" onClick={() => setExplanation((explanation+1) % preview.concept.explanations.length)}>{tamil ? "வேறு விதமாக விளக்குங்கள்" : "Explain another way"}</button>
      </section>
      <section className="cv-question"><h2>{tamil ? "முயன்று பாருங்கள்" : "Try it yourself"}</h2><p>{preview.exercise.prompt[language]}</p>
        <AudioPrompt key={language} src={assets + "/" + skill + "-" + (tamil ? "ta" : "en") + ".mp3"} label={tamil ? "கேள்வியைக் கேளுங்கள்" : "Hear the question"} pauseLabel={tamil ? "இடைநிறுத்து" : "Pause audio"} errorLabel={tamil ? "மேலே உள்ள கேள்வியைப் படிக்கலாம்." : "The question is written above."} disabled={false} onStart={el => { playing.current = el; }} />
        <form onSubmit={event => { event.preventDefault(); if (reply.trim()) { setChecked(reply.trim()); setAttempt(attempt+1); } }}>
          <label htmlFor="skill-answer">{tamil ? "உங்கள் பதில்" : "Your answer"}</label>
          <textarea id="skill-answer" required maxLength={1000} value={reply} onChange={event => setReply(event.target.value)} />
          <button className="skill-primary" disabled={!reply.trim()}>{tamil ? "பதிலைச் சரிபாருங்கள்" : "Check my answer"} <ArrowRight size={16} /></button>
        </form>
        <div role="status">{result && checked === reply.trim() && <div className="cv-feedback"><strong>{tamil ? "கால்வி" : "Callvi"}</strong><p>{result.feedback}</p>{result.hint && <p>{result.hint}</p>}{result.modelAnswer && <p>{result.modelAnswer}</p>}</div>}</div>
      </section>
    </div> : <SkillHome language={language} lessonHref={link}>
      {standalone ? <a className="skill-primary" href="./call-sample.html"><Headphones size={17} />{tamil ? "மாதிரி அழைப்பைக் கேளுங்கள்" : "Listen to a sample call"}</a> : <a href={home} className="skill-primary">{text.call}</a>}
      <a className="skill-secondary" href="#skills">{tamil ? "பாடத்தை முயலுங்கள்" : "Try a lesson"}<ArrowRight size={16} /></a>
    </SkillHome>}</main>
  </div></div>;
}
