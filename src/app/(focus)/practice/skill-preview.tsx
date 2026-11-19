"use client";

import { useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, AudioLines, Headphones } from "lucide-react";
import { callPractice, getSkillPreview } from "@/content/skill-preview";
import { assessAnswer } from "@/lib/assessment/assessment-service";
import { voiceCopy } from "@/lib/voice/copy";
import { useDocumentLanguage } from "@/lib/use-document-language";
import type { LanguageCode } from "@/lib/languages";
import { SkillHome } from "@/components/room/skill-home";
import styles from "@/components/room/voice-entry.module.css";
import { PracticeReply } from "./practice-reply";
import { AudioPrompt } from "./audio-prompt";

/**
 * Interface copy for this screen. Lesson content comes from the authored
 * curriculum; only the controls around it live here, so a translator edits
 * one table rather than hunting ternaries through the markup.
 */
const copy = {
  "en-IN": {
    title: "Callvi · Learn by phone",
    allSkills: "All skills",
    explainAgain: "Explain another way",
    tryIt: "Try it yourself",
    hearQuestion: "Hear the question",
    pauseAudio: "Pause audio",
    audioError: "The question is written above.",
    answerLabel: "Your answer",
    check: "Check my answer",
    coach: "Callvi",
    sampleCall: "Listen to a sample call",
    tryLesson: "Try a lesson",
  },
  "ta-IN": {
    title: "கால்வி · தொலைபேசியில் கற்கலாம்",
    allSkills: "திறன்கள்",
    explainAgain: "வேறு விதமாக விளக்குங்கள்",
    tryIt: "முயன்று பாருங்கள்",
    hearQuestion: "கேள்வியைக் கேளுங்கள்",
    pauseAudio: "இடைநிறுத்து",
    audioError: "மேலே உள்ள கேள்வியைப் படிக்கலாம்.",
    answerLabel: "உங்கள் பதில்",
    check: "பதிலைச் சரிபாருங்கள்",
    coach: "கால்வி",
    sampleCall: "மாதிரி அழைப்பைக் கேளுங்கள்",
    tryLesson: "பாடத்தை முயலுங்கள்",
  },
} as const;

const LANGUAGES = ["ta-IN", "en-IN"] as const;

export function SkillPreview({ language: initial, skill, standalone = false }: {
  language: LanguageCode;
  skill: string;
  standalone?: boolean;
}) {
  const [language, setLanguage] = useState(initial);
  const [reply, setReply] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [checked, setChecked] = useState("");
  const [explanation, setExplanation] = useState(0);
  const playing = useRef<HTMLAudioElement | null>(null);

  const tamil = language === "ta-IN";
  const text = copy[language];
  const voice = voiceCopy(language);
  const preview = getSkillPreview(skill);
  const isCall = skill === "communication";
  // The communication lesson keeps its own language state, so it owns the document while it is shown.
  useDocumentLanguage(language, preview ? `${preview.concept.title[language]} · Callvi` : text.title, standalone && !isCall);

  const assets = standalone ? "./rehearsal" : "/rehearsal";
  const home = homeHref(standalone, tamil);

  if (isCall) {
    return <PracticeReply exercise={callPractice} language={language} assets={assets} homeHref={home} syncDocument={standalone} />;
  }

  const lessonHref = (id: string) => (standalone ? "./" : "/practice") + "?skill=" + id + "&lang=" + (tamil ? "ta" : "en");
  const result = preview && attempt
    ? assessAnswer({ exercise: preview.exercise, language, answerText: checked, attemptNumber: attempt })
    : null;

  function chooseLanguage(code: LanguageCode) {
    playing.current?.pause();
    setLanguage(code);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const answer = reply.trim();
    if (!answer) return;
    setChecked(answer);
    setAttempt(attempt + 1);
  }

  return (
    <div className={styles.landing} lang={tamil ? "ta" : "en"}>
      <div className={styles.pageFrame}>
        <header className={styles.header}>
          <a className={styles.wordmark} href={home} aria-label="Callvi">
            <AudioLines aria-hidden />callvi
          </a>
          <div className={styles.headerActions}>
            <div className={styles.languagePill} role="group" aria-label={voice.language}>
              {LANGUAGES.map(code => (
                <button key={code} type="button" lang={code === "ta-IN" ? "ta" : "en"}
                  className={language === code ? styles.selectedLanguage : ""}
                  aria-pressed={language === code} onClick={() => chooseLanguage(code)}>
                  {code === "ta-IN" ? "தமிழ்" : "English"}
                </button>
              ))}
            </div>
          </div>
        </header>

        <main className={styles.main} id="main">
          {preview ? (
            <div className="cv-reader">
              <a href={home + "#skills"} className="cv-back"><ArrowLeft size={16} aria-hidden />{text.allSkills}</a>
              <p className="skill-overline">{preview.course[language]}</p>
              <h1>{preview.concept.title[language]}</h1>

              <section className="cv-concept" aria-label={preview.concept.title[language]}>
                {/* Announced when "Explain another way" swaps it, which would otherwise be silent. */}
                <p aria-live="polite">{preview.concept.explanations[explanation].text[language]}</p>
                <button type="button"
                  onClick={() => setExplanation((explanation + 1) % preview.concept.explanations.length)}>
                  {text.explainAgain}
                </button>
              </section>

              <section className="cv-question" aria-labelledby="question-heading">
                <h2 id="question-heading">{text.tryIt}</h2>
                <p>{preview.exercise.prompt[language]}</p>
                <AudioPrompt key={language} src={`${assets}/${skill}-${tamil ? "ta" : "en"}.mp3`}
                  label={text.hearQuestion} pauseLabel={text.pauseAudio} errorLabel={text.audioError}
                  disabled={false} onStart={element => { playing.current = element; }} />

                <form onSubmit={submit}>
                  <label htmlFor="skill-answer">{text.answerLabel}</label>
                  <textarea id="skill-answer" required maxLength={1000} value={reply}
                    onChange={event => setReply(event.target.value)} />
                  <button className="skill-primary" disabled={!reply.trim()}>
                    {text.check} <ArrowRight size={16} aria-hidden />
                  </button>
                </form>

                <div role="status">
                  {result && checked === reply.trim() && (
                    <div className="cv-feedback">
                      <strong>{text.coach}</strong>
                      <p>{result.feedback}</p>
                      {result.hint && <p>{result.hint}</p>}
                      {result.modelAnswer && <p>{result.modelAnswer}</p>}
                    </div>
                  )}
                </div>
              </section>
            </div>
          ) : (
            <SkillHome language={language} lessonHref={lessonHref}>
              {standalone
                ? <a className="skill-primary" href="./call-sample.html"><Headphones size={17} aria-hidden />{text.sampleCall}</a>
                : <a href={home} className="skill-primary">{voice.call}</a>}
              <a className="skill-secondary" href="#skills">{text.tryLesson}<ArrowRight size={16} aria-hidden /></a>
            </SkillHome>
          )}
        </main>
      </div>
    </div>
  );
}

/** The static build is served from a folder, so its links stay relative; the Next app routes from the root. */
function homeHref(standalone: boolean, tamil: boolean) {
  return (standalone ? "./" : "/") + (standalone && tamil ? "?lang=ta" : "");
}
