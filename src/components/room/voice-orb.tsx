import type { CSSProperties } from "react";

/** The shape responds only to measured audio amplitude; idle is still. */
export function VoiceOrb({ level = 0, className = "" }: { level?: number; className?: string }) {
  return (
    <div aria-hidden className={`voice-orb ${className}`} style={{ "--voice-level": Math.max(0, Math.min(1, level)) } as CSSProperties}>
      <span className="voice-orb-light" />
    </div>
  );
}
