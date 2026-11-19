"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowRight, AudioLines, Check, Phone, RotateCcw } from "lucide-react";
import { assessAnswer } from "@/lib/assessment/assessment-service";
import type { Exercise } from "@/content/schema";
import type { LanguageCode } from "@/lib/languages";
import { useDocumentLanguage } from "@/lib/use-document-language";
import { AudioPrompt } from "./audio-prompt";
import { Dictation } from "./dictation";
import "./rehearsal.css";

const words = {
  "en-IN": {
    back: "Back to Callvi",
    title: "Practise a clear reply",
    tailor: "Home tailor",
    language: "Language",
    skill: "Communication",
    sampleCall: "Hear a live AI call sample",
    fee: "Your fee",
    time: "Pickup",
    days: "2 days",
    customer: "The customer",
    question: "Could you shorten these trousers for forty rupees? I need them tomorrow.",
    listen: "Hear the customer",
    pause: "Pause audio",
    audioError: "Audio is unavailable. Read the text above.",
    turn: "Your turn.",
    label: "What would you say to the customer?",
    examples: "Try a reply",
    options: ["Fee only", "Pickup only", "Both details"],
    answers: [
      "I charge fifty rupees.",
      "I can have them ready in two days.",
      "I charge fifty rupees and can have them ready in two days. Does that work?",
    ],
    check: "Check my reply",
    reset: "Start over",
    coach: "Callvi’s feedback",
    hearTip: "Hear feedback",
    history: "Your attempts",
    price: "Fee",
    pickup: "Pickup time",
    heard: "heard",
    missing: "still needed",
    attempt: "Attempt",
    privacy: "Your written replies stay in this tab.",
    empty: "Type a reply, or choose one to edit.",
  },
  "ta-IN": {
    back: "கால்விக்குத் திரும்பு",
    title: "தெளிவாகப் பதில் சொல்லுங்கள்",
    tailor: "வீட்டுத் தையல் கலைஞர்",
    language: "மொழி",
    skill: "உரையாடல் திறன்கள்",
    sampleCall: "மாதிரி அழைப்பைக் கேளுங்கள் (ஆங்கிலம்)",
    fee: "உங்கள் கூலி",
    time: "தர வேண்டிய நேரம்",
    days: "2 நாட்கள்",
    customer: "வாடிக்கையாளர்",
    question: "அக்கா, இந்த பேண்ட் கொஞ்சம் நீளம் குறைக்கணும். நாற்பது ரூபாய்க்கு செஞ்சு, நாளைக்குத் தர முடியுமா?",
    listen: "வாடிக்கையாளர் குரலைக் கேளுங்கள்",
    pause: "ஒலியை நிறுத்து",
    audioError: "ஒலி கிடைக்கவில்லை. மேலே உள்ள உரையைப் படிக்கலாம்.",
    turn: "உங்கள் முறை.",
    label: "வாடிக்கையாளரிடம் என்ன சொல்வீங்க?",
    examples: "ஒரு பதிலை முயலுங்கள்",
    options: ["கூலி மட்டும்", "நேரம் மட்டும்", "இரண்டும்"],
    answers: [
      "ஐம்பது ரூபாய் ஆகும்.",
      "ரெண்டு நாள்ல தருவேன்.",
      "ஐம்பது ரூபாய் ஆகும். ரெண்டு நாள்ல முடிச்சுத் தருவேன். சரியா?",
    ],
    check: "பதிலைச் சரிபார்",
    reset: "மீண்டும் தொடங்கு",
    coach: "கால்வியின் கருத்து",
    hearTip: "கருத்தைக் கேளுங்கள்",
    history: "உங்கள் முயற்சிகள்",
    price: "கூலி",
    pickup: "தரும் நேரம்",
    heard: "சொன்னீர்கள்",
    missing: "சேர்க்க வேண்டும்",
    attempt: "முயற்சி",
    privacy: "நீங்கள் எழுதும் பதில்கள் இந்தப் பக்கத்திலேயே இருக்கும்.",
    empty: "பதில் எழுதுங்கள் அல்லது ஒரு பதிலைத் தேர்ந்தெடுத்து மாற்றுங்கள்.",
  },
} as const;

const LANGUAGES = ["ta-IN", "en-IN"] as const;

export function PracticeReply({
  exercise,
  language: initialLanguage,
  assets = "/rehearsal",
  homeHref,
  syncDocument = false,
}: {
  exercise: Exercise;
  language: LanguageCode;
  assets?: string;
  homeHref?: string;
  /** Set by the standalone preview, where no server render sets `<html lang>` per language. */
  syncDocument?: boolean;
}) {
  const [language, setLanguage] = useState(initialLanguage);
  const [reply, setReply] = useState("");
  const [attempts, setAttempts] = useState<string[]>([]);
  const [dictating, setDictating] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  const text = words[language];
  const langCode = language === "ta-IN" ? "ta" : "en";
  const labels = [text.price, text.pickup];
  useDocumentLanguage(language, `${text.title} · Callvi`, syncDocument);

  // Grading is pure and cheap, so every attempt is re-graded when the language flips and the feedback follows it.
  const graded = useMemo(
    () =>
      attempts.map((answer, i) =>
        assessAnswer({
          exercise,
          language,
          answerText: answer,
          attemptNumber: i + 1,
        }),
      ),
    [attempts, exercise, language],
  );
  const latest = graded.at(-1);

  function changeLanguage(next: LanguageCode) {
    if (next === language) return;
    setDictating(false);
    audio.current?.pause();
    setLanguage(next);
  }

  /** Only one clip plays at a time: a new one pauses whatever was speaking. */
  function onAudioStart(element: HTMLAudioElement) {
    if (audio.current !== element) audio.current?.pause();
    audio.current = element;
  }
  const audioProps = {
    disabled: dictating,
    onStart: onAudioStart,
    pauseLabel: text.pause,
    errorLabel: text.audioError,
  };

  /** Picks the recorded coaching clip that matches what the reply was missing. */
  function feedbackClip() {
    if (latest?.result === "correct") return "both";
    if (latest?.result === "partial") return latest.metCriteria.includes("quoted-fee") ? "fee" : "pickup";
    return latest?.result === "ungraded" ? "ungraded" : "retry";
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const answer = reply.trim();
    if (!answer || dictating) return;
    setAttempts([...attempts, answer]);
    setReply("");
  }

  function startOver() {
    setAttempts([]);
    setReply("");
    input.current?.focus();
  }

  return (
    <div className="cv-studio" lang={langCode}>
      <header className="cv-header">
        <a className="cv-brand" href={homeHref ?? "./"} aria-label="Callvi">
          <AudioLines aria-hidden />
          callvi
        </a>
        <div className="cv-language" role="group" aria-label={text.language}>
          {LANGUAGES.map((code) => (
            <button
              key={code}
              type="button"
              lang={code}
              aria-pressed={code === language}
              onClick={() => changeLanguage(code)}
            >
              {code === "ta-IN" ? "தமிழ்" : "English"}
            </button>
          ))}
        </div>
      </header>

      <main id="main" className="cv-grid">
        <section className="cv-brief" aria-labelledby="scenario-title">
          <div className="cv-brief-text">
            <span className="cv-role">
              <Phone size={15} aria-hidden />
              {text.skill}
            </span>
            <h1 id="scenario-title">{text.title}</h1>
            <p>{text.tailor}</p>
            <dl>
              <div>
                <dt>{text.fee}</dt>
                <dd>₹50</dd>
              </div>
              <div>
                <dt>{text.time}</dt>
                <dd>{text.days}</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="cv-work" aria-labelledby="turn-heading">
          <div className="cv-customer">
            <p className="cv-kicker">{text.customer}</p>
            <blockquote>“{text.question}”</blockquote>
            <AudioPrompt
              key={langCode}
              src={`${assets}/customer-${langCode}.mp3`}
              label={text.listen}
              {...audioProps}
            />
          </div>

          <form onSubmit={submit}>
            <h2 id="turn-heading">{text.turn}</h2>
            <label htmlFor="reply">{text.label}</label>
            <textarea
              id="reply"
              ref={input}
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              rows={2}
              maxLength={1000}
              placeholder={text.empty}
              required
            />
            <Dictation
              key={language}
              language={language}
              active={dictating}
              onActive={(active) => {
                if (active) audio.current?.pause();
                setDictating(active);
              }}
              onWords={(spoken) =>
                setReply((previous) => [previous.trim(), spoken].filter(Boolean).join(" ").slice(0, 1000))
              }
            />
            <div className="cv-examples">
              <span>{text.examples}</span>
              {text.options.map((option, i) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setReply(text.answers[i]);
                    input.current?.focus();
                  }}
                >
                  {option}
                </button>
              ))}
            </div>
            <button className="cv-submit" disabled={!reply.trim() || dictating}>
              {text.check}
              <ArrowRight size={17} aria-hidden />
            </button>
          </form>

          <div aria-live="polite" aria-atomic="true">
            {latest && (
              <section className="cv-feedback" aria-label={text.coach}>
                <p className="cv-kicker">{text.coach}</p>
                <p>{latest.feedback}</p>
                {latest.modelAnswer && <p>{latest.modelAnswer}</p>}
                <AudioPrompt
                  key={langCode + attempts.length}
                  src={`${assets}/${langCode}-${feedbackClip()}.mp3`}
                  label={text.hearTip}
                  {...audioProps}
                />
              </section>
            )}
          </div>
        </section>

        {attempts.length > 0 && (
          <section className="cv-history" aria-labelledby="history-heading">
            <div className="cv-history-title">
              <h2 id="history-heading">{text.history}</h2>
              <button type="button" disabled={dictating} onClick={startOver}>
                <RotateCcw size={15} aria-hidden />
                {text.reset}
              </button>
            </div>
            <ol>
              {attempts.map((answer, i) => (
                <li key={i}>
                  <span className="cv-kicker">
                    {text.attempt} {i + 1}
                  </span>
                  <q>{answer}</q>
                  <div className="cv-checks">
                    {exercise.rubric.criteria.map((criterion, j) => {
                      const met = graded[i].metCriteria.includes(criterion.id);
                      return (
                        <span className={met ? "cv-met" : "cv-miss"} key={criterion.id}>
                          {met && <Check size={14} aria-hidden />}
                          {labels[j]} · {met ? text.heard : text.missing}
                        </span>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}
      </main>

      <footer className="cv-foot">
        <span>{text.privacy}</span>
        {homeHref ? <a href={homeHref}>{text.back}</a> : <a href="./call-sample.html">{text.sampleCall}</a>}
      </footer>
    </div>
  );
}
