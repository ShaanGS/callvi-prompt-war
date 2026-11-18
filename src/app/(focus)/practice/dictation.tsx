"use client";

import { useEffect, useRef, useState } from "react";
import type { LanguageCode } from "@/lib/languages";

interface Recognition {
  lang: string;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
  stop(): void;
}

interface SpeechWindow extends Window {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
}

const copy = {
  "en-IN": {
    title: "Speak a reply", note: "Your browser may send microphone audio to its speech service. Review the words before checking your reply.",
    start: "Use microphone", stop: "Finish speaking", listening: "Listening…",
    unavailable: "Dictation is unavailable here. You can type your reply or edit an example.",
    failed: "No words captured. Try the microphone again or type your reply.",
  },
  "ta-IN": {
    title: "பதிலைப் பேசுங்கள்", note: "உங்கள் உலாவி ஒலியை அதன் குரல் சேவைக்கு அனுப்பலாம். பேசிய வார்த்தைகளைப் பார்த்த பிறகு பதிலைச் சரிபாருங்கள்.",
    start: "மைக்ரோஃபோனைப் பயன்படுத்து", stop: "பேசி முடித்தேன்", listening: "கேட்கிறது…",
    unavailable: "இங்கே குரல் பதிவு கிடைக்கவில்லை. பதிலை எழுதலாம் அல்லது மாதிரிப் பதிலை மாற்றலாம்.",
    failed: "வார்த்தைகள் பதிவாகவில்லை. மீண்டும் பேசுங்கள் அல்லது பதிலை எழுதுங்கள்.",
  },
};

export function Dictation({ language, active, onActive, onWords }: {
  language: LanguageCode; active: boolean; onActive: (active: boolean) => void; onWords: (words: string) => void;
}) {
  const session = useRef<Recognition | null>(null);
  const [message, setMessage] = useState("");
  const words = copy[language];

  function cancel() {
    const current = session.current;
    if (current) {
      current.onresult = current.onerror = current.onend = null;
      current.abort();
      session.current = null;
    }
  }

  useEffect(() => cancel, []);

  function toggle() {
    if (session.current) {
      session.current.stop();
      return;
    }
    const browser = window as SpeechWindow;
    const Engine = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
    if (!Engine) { setMessage(words.unavailable); return; }
    let heard = false;
    try {
      const mic = new Engine();
      session.current = mic;
      mic.lang = language;
      mic.onresult = event => {
        const transcript = event.results[0]?.[0]?.transcript.trim();
        if (transcript) { heard = true; onWords(transcript); }
      };
      mic.onerror = () => setMessage(words.failed);
      mic.onend = () => {
        session.current = null;
        onActive(false);
        setMessage(heard ? "" : words.failed);
      };
      onActive(true);
      setMessage(words.listening);
      mic.start();
    } catch {
      cancel();
      onActive(false);
      setMessage(words.failed);
    }
  }

  return <details className="cv-dictation" onToggle={event => {
    if (!event.currentTarget.open && session.current) { cancel(); onActive(false); setMessage(""); }
  }}>
    <summary>{words.title}</summary>
    <p>{words.note}</p>
    <button type="button" onClick={toggle}>{active ? words.stop : words.start}</button>
    <span role="status">{message}</span>
  </details>;
}
