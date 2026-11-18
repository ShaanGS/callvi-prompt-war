"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowRight, AudioLines, Check, Headphones, Pause, Phone, RotateCcw } from "lucide-react";
import { assessAnswer } from "@/server/services/assessment/assessment-service";
import type { Exercise } from "@/content/schema";
import type { LanguageCode } from "@/lib/languages";
import "./rehearsal.css";

const words = {
  "en-IN": {
    back: "Back to Callvi", title: "The tailoring call", tailor: "Home tailor",
    fee: "Your fee", time: "Pickup", days: "2 days", customer: "The customer",
    question: "Could you shorten these trousers for forty rupees? I need them tomorrow.",
    listen: "Hear the customer", pause: "Pause audio", audioError: "Audio is unavailable. The customer’s words are shown above.",
    turn: "Your turn.", label: "What would you say to the customer?",
    examples: "Try a reply", options: ["Fee only", "Pickup only", "Both details"],
    answers: ["I charge fifty rupees.", "I can have them ready in two days.", "I charge fifty rupees and can have them ready in two days. Does that work?"],
    check: "Check my reply", reset: "Start over", coach: "Callvi’s feedback", history: "Your attempts",
    price: "Fee", pickup: "Pickup time", heard: "heard", missing: "still needed", attempt: "Attempt",
    privacy: "Your written replies stay in this tab.", empty: "Type a reply, or choose one to edit.",
  },
  "ta-IN": {
    back: "கால்விக்குத் திரும்பு", title: "ஒரு தையல் அழைப்பு", tailor: "வீட்டுத் தையல் கலைஞர்",
    fee: "உங்கள் கூலி", time: "தர வேண்டிய நேரம்", days: "2 நாட்கள்", customer: "வாடிக்கையாளர்",
    question: "அக்கா, இந்த பேண்ட் கொஞ்சம் நீளம் குறைக்கணும். நாற்பது ரூபாய்க்கு செஞ்சு, நாளைக்குத் தர முடியுமா?",
    listen: "வாடிக்கையாளர் குரலைக் கேளுங்கள்", pause: "ஒலியை நிறுத்து", audioError: "ஒலி கிடைக்கவில்லை. மேலே உள்ள கேள்வியைப் படிக்கலாம்.",
    turn: "உங்கள் முறை.", label: "வாடிக்கையாளரிடம் என்ன சொல்வீங்க?",
    examples: "ஒரு பதிலை முயலுங்கள்", options: ["கூலி மட்டும்", "நேரம் மட்டும்", "இரண்டும்"],
    answers: ["ஐம்பது ரூபாய் ஆகும்.", "ரெண்டு நாள்ல தருவேன்.", "ஐம்பது ரூபாய் ஆகும். ரெண்டு நாள்ல முடிச்சுத் தருவேன். சரியா?"],
    check: "பதிலைச் சரிபார்", reset: "மீண்டும் தொடங்கு", coach: "கால்வியின் கருத்து", history: "உங்கள் முயற்சிகள்",
    price: "கூலி", pickup: "தரும் நேரம்", heard: "சொன்னீர்கள்", missing: "சேர்க்க வேண்டும்", attempt: "முயற்சி",
    privacy: "நீங்கள் எழுதும் பதில்கள் இந்தப் பக்கத்திலேயே இருக்கும்.", empty: "பதில் எழுதுங்கள் அல்லது ஒரு பதிலைத் தேர்ந்தெடுத்து மாற்றுங்கள்.",
  },
} as const;

export function PracticeReply({ exercise, language: initialLanguage, assets = "/rehearsal", homeHref }: {
  exercise: Exercise; language: LanguageCode; assets?: string; homeHref?: string;
}) {
  const [language, setLanguage] = useState(initialLanguage);
  const [reply, setReply] = useState("");
  const [attempts, setAttempts] = useState<string[]>([]);
  const [playing, setPlaying] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const text = words[language];
  const graded = useMemo(() => attempts.map((answer, i) => assessAnswer({
    exercise, language, answerText: answer, attemptNumber: i + 1,
  })), [attempts, exercise, language]);
  const latest = graded.at(-1);
  const labels = [text.price, text.pickup];
  const langCode = language === "ta-IN" ? "ta" : "en";
  function changeLanguage(next: LanguageCode) {
    audio.current?.pause();
    setPlaying(false);
    setAudioError(false);
    setLanguage(next);
  }
  async function listen() {
    if (!audio.current) return;
    if (playing) { audio.current.pause(); return; }
    try { await audio.current.play(); setAudioError(false); }
    catch { setAudioError(true); }
  }

  return <div className="cv-studio" lang={langCode}>
    <header className="cv-header">
      <div className="cv-brand"><AudioLines aria-hidden />callvi<span>/</span><span>{language === "ta-IN" ? "பயிற்சி" : "Rehearsal"}</span></div>
      <div className="cv-language" aria-label="Language">
        {(["ta-IN", "en-IN"] as const).map(code => <button key={code} type="button" lang={code} aria-pressed={code === language} onClick={() => changeLanguage(code)}>{code === "ta-IN" ? "தமிழ்" : "English"}</button>)}
      </div>
    </header>
    <main id="main" className="cv-grid">
      <section className="cv-brief" aria-labelledby="scenario-title">
        <div className="cv-photo" role="img" aria-label={language === "ta-IN" ? "தையல் மேசையில் ஒரு விசைப்பலகை போன்" : "A keypad phone on a tailor’s worktable"} style={{backgroundImage: "url(" + assets + "/worktable.webp)"}} />
        <div className="cv-brief-text">
          <span className="cv-role"><Phone size={15} aria-hidden />{text.tailor}</span>
          <h1 id="scenario-title">{text.title}</h1>
          <dl><div><dt>{text.fee}</dt><dd>₹50</dd></div><div><dt>{text.time}</dt><dd>{text.days}</dd></div></dl>
        </div>
      </section>
      <section className="cv-work">
        <div className="cv-customer"><p className="cv-kicker">{text.customer}</p>
          <blockquote>“{text.question}”</blockquote>
          <audio key={langCode} ref={audio} preload="none" src={assets + "/customer-" + langCode + ".mp3"} onPlaying={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onError={() => setAudioError(true)} />
          <button className="cv-audio" onClick={listen}>{playing ? <Pause size={15} /> : <Headphones size={16} />} {playing ? text.pause : text.listen}</button>
          {audioError && <p role="status">{text.audioError}</p>}
        </div>
        <form onSubmit={event => { event.preventDefault(); if (reply.trim()) { setAttempts([...attempts, reply.trim()]); setReply(""); } }}>
          <h2>{text.turn}</h2>
          <label htmlFor="reply">{text.label}</label>
          <textarea id="reply" ref={input} value={reply} onChange={event => setReply(event.target.value)} rows={2} maxLength={1000} placeholder={text.empty} required />
          <div className="cv-examples"><span>{text.examples}</span>{text.options.map((option,i) => <button key={i} type="button" onClick={() => { setReply(text.answers[i]); input.current?.focus(); }}>{option}</button>)}</div>
          <button className="cv-submit" disabled={!reply.trim()}>{text.check}<ArrowRight size={17} /></button>
        </form>
        <div aria-live="polite" aria-atomic="true">
          {latest && <section className="cv-feedback"><p className="cv-kicker">{text.coach}</p><p>{latest.feedback}</p>
            {latest.modelAnswer && <p>{latest.modelAnswer}</p>}
          </section>}
        </div>
      </section>
      {attempts.length > 0 && <section className="cv-history"><div className="cv-history-title"><h2>{text.history}</h2>
        <button onClick={() => { setAttempts([]); setReply(""); input.current?.focus(); }}><RotateCcw size={15} />{text.reset}</button></div>
        <ol>{attempts.map((answer,i) => <li key={i}>
          <span className="cv-kicker">{text.attempt} {i+1}</span><q>{answer}</q><div className="cv-checks">
          {exercise.rubric.criteria.map((criterion,j) => { const met = graded[i].metCriteria.includes(criterion.id);
            return <span className={met ? "cv-met" : "cv-miss"} key={criterion.id}>{met && <Check size={14} />}{labels[j]} · {met ? text.heard : text.missing}</span>;
          })}</div></li>)}</ol>
      </section>}
    </main>
    <footer className="cv-foot"><span>{text.privacy}</span>{homeHref ? <a href={homeHref}>{text.back}</a> : <a href="https://github.com/ShaanGS/callvi-prompt-war">GitHub ↗</a>}</footer>
  </div>;
}
