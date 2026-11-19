"use client";

import { useRef, useState } from "react";
import { Headphones, Pause } from "lucide-react";

export function AudioPrompt({
  src,
  label,
  pauseLabel,
  errorLabel,
  disabled,
  onStart,
}: {
  src: string;
  label: string;
  pauseLabel: string;
  errorLabel: string;
  disabled: boolean;
  onStart: (element: HTMLAudioElement) => void;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

  async function toggle() {
    const element = audio.current;
    if (!element) return;
    if (playing) {
      element.pause();
      return;
    }
    try {
      onStart(element);
      await element.play();
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }

  return (
    <>
      <audio
        ref={audio}
        preload="none"
        src={src}
        onPlaying={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => setFailed(true)}
      />
      <button type="button" className="cv-audio" disabled={disabled} onClick={toggle}>
        {playing ? <Pause size={15} /> : <Headphones size={16} />} {playing ? pauseLabel : label}
      </button>
      {failed && <p role="status">{errorLabel}</p>}
    </>
  );
}
