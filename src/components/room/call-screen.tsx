"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { BookOpen, Captions, ChevronDown, Mic, MicOff, Phone, PhoneOff, Volume2, VolumeX, X } from "lucide-react";
import { fmt } from "@/lib/i18n";
import { formatCallDuration, isActivePhase, type VoiceState } from "@/lib/voice/voice-state";
import { VoiceOrb } from "./voice-orb";
import type { RoomCopy } from "./learning-room";

/** A genuine connecting screen followed by the live audio surface. */
export function CallScreen({
  state,
  copy,
  name,
  conceptTitle,
  fallbackHref,
  onMute,
  onEnd,
  onRetry,
  onClose,
  onMinimise,
  onToggleOutput,
  outputMuted = false,
}: {
  state: VoiceState;
  copy: RoomCopy;
  name: string;
  conceptTitle: string | null;
  fallbackHref: string;
  onMute: () => void;
  onEnd: () => void;
  onRetry: () => void;
  onClose: () => void;
  onMinimise: () => void;
  onToggleOutput?: () => void;
  outputMuted?: boolean;
}) {
  const call = copy.room.call;
  const v = copy.room.voice;
  const dialogRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const [captions, setCaptions] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const active = isActivePhase(state.phase);
  const connecting = state.phase === "requesting_mic" || state.phase === "connecting";
  const failed = state.phase === "error";
  const tamil = copy.room.voice.you === "நீங்கள்";

  useEffect(() => {
    primaryRef.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [connecting, failed]);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    navigator.wakeLock
      .request("screen")
      .then((value) => {
        if (cancelled) void value.release();
        else lock = value;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      void lock?.release();
    };
  }, [active]);

  const trapFocus = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      if (failed) onClose();
      else onMinimise();
      return;
    }
    if (event.key !== "Tab") return;
    const controls = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled]), a[href]") ?? [],
    );
    const first = controls[0],
      last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first && last) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last && first) {
      event.preventDefault();
      first.focus();
    }
  };
  const duration = state.connectedAt === null ? "" : formatCallDuration(now - state.connectedAt);
  const activity =
    state.phase === "agent_speaking"
      ? fmt(call.speaking, { name })
      : state.phase === "learner_speaking"
        ? call.youSpeaking
        : state.muted
          ? call.muted
          : call.listening;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={fmt(call.dialogLabel, { name })}
      onKeyDown={trapFocus}
      className={`fixed inset-0 z-50 flex min-h-dvh flex-col ${connecting ? "call-surface bg-call text-white" : "voice-live-surface"}`}
      style={{
        paddingTop: "max(env(safe-area-inset-top), 1.5rem)",
        paddingBottom: "max(env(safe-area-inset-bottom), 1.5rem)",
      }}
    >
      {connecting ? (
        <>
          <div className="flex flex-col items-center px-6 pt-[9vh] text-center">
            <p className="text-xl text-white/65" role="status">
              {state.phase === "requesting_mic" ? call.allowMic : call.calling}
            </p>
            <h2 className="mt-2 text-5xl font-semibold tracking-tight sm:text-6xl">{name}</h2>
            <p className="mt-4 text-sm text-white/70">{copy.app.aiLabel}</p>
          </div>
          <div className="flex flex-1 items-center justify-center">
            <div className="grid size-24 place-items-center rounded-full border border-white/10 text-4xl font-medium text-white/20">
              C
            </div>
          </div>
          <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-8 px-8 pb-8">
            <div className="flex w-full justify-around gap-4">
              <DialControl label={call.mute} icon={<MicOff className="size-7" />} disabled />
              <DialControl
                label={call.captions}
                icon={<Captions className="size-7" />}
                onClick={() => setCaptions((value) => !value)}
              />
              <DialControl label={call.lesson} icon={<BookOpen className="size-7" />} onClick={onMinimise} />
            </div>
            <DialControl ref={primaryRef} label={call.end} icon={<PhoneOff className="size-7" />} onClick={onEnd} end />
          </div>
        </>
      ) : failed ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
          <VoiceOrb className="opacity-40" />
          <h2 className="mt-6 text-2xl font-medium">{call.failed}</h2>
          <p className="max-w-sm text-sm text-muted" role="alert">
            {state.error ? v.errors[state.error] : v.errors.generic}
          </p>
          <div className="flex gap-4">
            <Control label={call.close} onClick={onClose} icon={<X className="size-6" />} />
            <Control
              ref={primaryRef}
              label={call.tryAgain}
              onClick={onRetry}
              icon={<Phone className="size-6" />}
              dark
            />
          </div>
          <Link href={fallbackHref} className="text-xs text-muted underline underline-offset-4">
            {v.switchToText}
          </Link>
        </div>
      ) : (
        <>
          <header className="flex items-center justify-between px-6 sm:px-10">
            <button
              type="button"
              onClick={onMinimise}
              aria-label={call.lesson}
              className="grid size-11 place-items-center rounded-full bg-white shadow-sm"
            >
              <ChevronDown className="size-6" />
            </button>
            <div className="text-center">
              <p className="text-base font-medium">{name}</p>
              <p className="mt-0.5 text-xs text-subtle">{copy.app.aiLabel}</p>
            </div>
            <span className="min-w-11 text-right text-sm tabular-nums text-subtle">{duration}</span>
          </header>
          <div className="relative flex flex-1 flex-col items-center justify-center gap-12 px-6 pb-10">
            <VoiceOrb level={state.level} />
            <div className="flex max-w-sm flex-col items-center gap-2 text-center">
              <p role="status" aria-live="polite" className="text-lg font-medium tracking-tight">
                {activity}
              </p>
              <p className="text-sm text-subtle">
                {conceptTitle ??
                  (tamil ? "உங்கள் அடுத்த படியை ஒன்றாகக் கண்டறிவோம்." : "Your next step starts with a conversation.")}
              </p>
            </div>
            {captions ? (
              <div className="absolute inset-x-4 bottom-3 mx-auto max-h-44 max-w-xl overflow-y-auto rounded-2xl border border-line bg-white/95 p-5 shadow-sm">
                {state.transcript.length === 0 ? (
                  <p className="text-sm text-muted">{call.captionsEmpty}</p>
                ) : (
                  <ol aria-label={call.captions} className="flex flex-col gap-3">
                    {state.transcript.slice(-3).map((line) => (
                      <li key={line.id} className="text-sm">
                        <span className="mr-2 font-medium text-subtle">{line.role === "companion" ? name : v.you}</span>
                        {line.text}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            ) : null}
          </div>
          <footer className="flex flex-col items-center gap-5 px-6 pb-5">
            <div className="flex items-center gap-4 sm:gap-6">
              {onToggleOutput ? (
                <Control
                  label={
                    outputMuted ? (tamil ? "ஒலியை இயக்கு" : "Enable audio") : tamil ? "ஒலியை நிறுத்து" : "Silence audio"
                  }
                  onClick={onToggleOutput}
                  pressed={outputMuted}
                  icon={outputMuted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
                />
              ) : null}
              <Control
                label={call.captions}
                onClick={() => setCaptions((value) => !value)}
                pressed={captions}
                icon={<Captions className="size-5" />}
              />
              <Control
                label={state.muted ? call.unmute : call.mute}
                onClick={onMute}
                pressed={state.muted}
                icon={state.muted ? <MicOff className="size-6" /> : <Mic className="size-6" />}
              />
              <Control ref={primaryRef} label={call.end} onClick={onEnd} icon={<X className="size-7" />} dark />
            </div>
            <p className="text-center text-xs text-subtle">
              {tamil
                ? "குறுக்கிடலாம். கேள்வி கேட்கலாம். உங்கள் வேகத்தில் பேசலாம்."
                : "Interrupt anytime. Ask anything. Go at your own pace."}
            </p>
          </footer>
        </>
      )}
    </div>
  );
}

function Control({
  ref,
  label,
  icon,
  onClick,
  pressed,
  dark = false,
}: {
  ref?: React.Ref<HTMLButtonElement>;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  pressed?: boolean;
  dark?: boolean;
}) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      onClick={onClick}
      className={`voice-control ${dark ? "voice-control-dark" : ""} ${pressed ? "ring-2 ring-accent/40" : ""}`}
    >
      {icon}
    </button>
  );
}
function DialControl({
  ref,
  label,
  icon,
  onClick,
  disabled,
  end = false,
}: {
  ref?: React.Ref<HTMLButtonElement>;
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  end?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2.5">
      <button
        ref={ref}
        type="button"
        aria-label={label}
        onClick={onClick}
        disabled={disabled}
        className={`voice-control voice-dial-control ${end ? "voice-dial-end" : ""}`}
      >
        {icon}
      </button>
      <span className="text-sm text-white/80">{label}</span>
    </div>
  );
}
