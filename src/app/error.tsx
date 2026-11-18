"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/button";

/** Route error boundary. Bilingual because it cannot read the learner's language. */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // The digest lets the team match this to the server log; no details are shown to the learner.
    console.error("route_error", error.digest ?? "");
  }, [error]);
  return (
    <main id="main" className="mx-auto flex min-h-dvh w-full max-w-prose flex-col justify-center gap-4 px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Something went wrong · ஏதோ தவறு நடந்தது</h1>
      <p className="text-muted">This page couldn&apos;t load. Your saved progress is not affected.</p>
      <p className="text-muted" lang="ta">
        இந்தப் பக்கத்தை ஏற்ற முடியவில்லை. உங்கள் சேமித்த முன்னேற்றம் பாதிக்கப்படவில்லை.
      </p>
      <div className="flex gap-3">
        <Button onClick={reset}>Try again · மீண்டும் முயல்</Button>
        <ButtonLink href="/" variant="secondary">
          Home · முகப்பு
        </ButtonLink>
      </div>
    </main>
  );
}
