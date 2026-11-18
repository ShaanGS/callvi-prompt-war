"use client";

import { useState } from "react";
import { assessAnswer, type AssessmentOutcome } from "@/server/services/assessment/assessment-service";
import type { Exercise } from "@/content/schema";
import type { LanguageCode } from "@/lib/languages";

export function PracticeReply({ exercise, language }: { exercise: Exercise; language: LanguageCode }) {
  const tamil = language === "ta-IN";
  const [reply, setReply] = useState("");
  const [attempts, setAttempts] = useState<{ answer: string; outcome: AssessmentOutcome }[]>([]);
  const previous = attempts.at(-1);
  return <>
    <form className="flex flex-col gap-3" onSubmit={(event) => {
      event.preventDefault();
      const answer = reply.trim();
      if (!answer) return;
      const outcome = assessAnswer({ exercise, language, answerText: answer, attemptNumber: attempts.length + 1 });
      setAttempts([...attempts, { answer, outcome }]);
      setReply("");
    }}>
      <label htmlFor="reply" className="font-medium">{tamil ? "வாடிக்கையாளரிடம் என்ன சொல்வீங்க?" : "What would you say to the customer?"}</label>
      <textarea id="reply" className="rounded-lg border border-line p-3" value={reply} onChange={(event) => setReply(event.target.value)} rows={3} maxLength={1000} required />
      <p className="text-sm text-muted">{tamil ? "இந்தப் பயிற்சிப் பதில்கள் இந்தப் பக்கத்தில் மட்டுமே இருக்கும்." : "Your practice replies stay on this page until you leave."}</p>
      <button disabled={!reply.trim()} className="self-start rounded-full bg-ink px-5 py-3 text-white disabled:opacity-50">{tamil ? "பதில் சரிபார்க்க" : "Check my reply"}</button>
    </form>
    <section aria-live="polite" aria-atomic="true">
      {previous && <div className="rounded-lg border border-line p-5">
        <h2 className="font-semibold">{tamil ? "கால்வியின் கருத்து" : "Callvi’s feedback"}</h2>
        <p className="my-2">{previous.outcome.feedback}</p>
        {previous.outcome.modelAnswer && <p>{previous.outcome.modelAnswer}</p>}
      </div>}
    </section>
    {attempts.length > 0 && <section>
      <h2 className="font-semibold">{tamil ? "உங்கள் முயற்சிகள்" : "Your attempts"}</h2>
      <ol className="list-decimal space-y-2 pl-6">{attempts.map(({ answer }, i) => <li key={i}>{answer}</li>)}</ol>
    </section>}
  </>;
}
