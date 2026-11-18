"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { ArrowRight, ArrowUpRight, AudioLines, Check, Globe2, Menu, Phone, ShieldCheck, SlidersHorizontal, Smartphone, Store, X } from "lucide-react";
import type { LanguageCode } from "@/lib/languages";
import type { ElevenLabsVoiceConfig } from "@/lib/voice/config";
import { voiceCopy } from "@/lib/voice/copy";
import { initialVoiceState, isActivePhase } from "@/lib/voice/voice-state";
import { setUiLanguage } from "@/app/actions/auth";
import { CallScreen } from "./call-screen";
import { VoiceOrb } from "./voice-orb";
import { useElevenLabsVoice } from "./use-elevenlabs-voice";
import { callRoomTool, closeDataSchema, fetchSessionView } from "./room-api";
import type { RoomCopy } from "./learning-room";
import styles from "./voice-entry.module.css";

const createdSchema = z.object({ ok: z.literal(true), session: z.object({
  sessionId: z.uuid(),
  sdk: z.union([
    z.object({ provider: z.literal("elevenlabs"), sessionId: z.uuid(), language: z.enum(["ta", "en"]) }),
    z.object({ user_identifier_type: z.literal("custom"), proxy_base_url: z.literal("/api/voice/sarvam/") }),
  ]),
}) });
const subscribeHydration = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export function VoiceEntry({ copy, language, ready, phoneNumber, resumeTitle, resumeSummary, deleted = false }: {
  copy: RoomCopy; language: LanguageCode; ready: boolean; phoneNumber?: string; resumeTitle: string | null; resumeSummary: string | null; deleted?: boolean;
}) {
  const text = voiceCopy(language);
  // SSR must not offer an enabled call button before its handler is attached.
  const hydrated = useSyncExternalStore(subscribeHydration, clientReady, serverReady);
  const router = useRouter();
  const [menu, setMenu] = useState<"learning" | "settings" | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [minimised, setMinimised] = useState(false);
  const [ended, setEnded] = useState<{ saved: boolean; summary: string | null } | null>(null);
  const [liveTitle, setLiveTitle] = useState<string | null>(null);
  const sessionRef = useRef<ElevenLabsVoiceConfig | null>(null);
  const closing = useRef(false);
  const beginGeneration = useRef(0);

  const finish = useCallback(() => {
    const session = sessionRef.current;
    if (!session || closing.current) return;
    closing.current = true;
    void callRoomTool(session.sessionId, "close_learning_session", { reason: "learner_ended" }).then(({ response }) => {
      if (!response.ok) throw new Error(response.error.message);
      const data = closeDataSchema.safeParse(response.data);
      setEnded({ saved: response.saved === true, summary: data.success ? data.data.summary ?? null : null });
      setMinimised(false);
      router.refresh();
    }).catch(() => {
      setError(copy.common.unknownError);
      setEnded({ saved: false, summary: null });
    });
  }, [copy.common.unknownError, router]);
  const voice = useElevenLabsVoice(null, finish);
  const active = isActivePhase(voice.state.phase);

  useEffect(() => {
    if (!active || !sessionRef.current) return;
    const timer = setInterval(() => {
      const session = sessionRef.current;
      if (session) void fetchSessionView(session.sessionId).then((view) => { if (view) setLiveTitle(view.concept?.title ?? view.course?.title ?? null); });
    }, 3500);
    return () => clearInterval(timer);
  }, [active]);

  const begin = async () => {
    if (creating || active) return;
    setCreating(true); setError(null); setEnded(null); setMinimised(false); setMenu(null);
    closing.current = false;
    const attempt = ++beginGeneration.current;
    try {
      const response = await fetch("/api/voice/browser-session", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
        signal: AbortSignal.timeout(20_000),
      });
      const payload = createdSchema.safeParse(await response.json().catch(() => null));
      if (!payload.success) throw new Error(text.unavailable);
      if (attempt !== beginGeneration.current) {
        void callRoomTool(payload.data.session.sessionId, "close_learning_session", { reason: "learner_ended" });
        return;
      }
      const { sdk, sessionId } = payload.data.session;
      if ("proxy_base_url" in sdk) {
        router.push(`/learn/${sessionId}`);
        return;
      }
      sessionRef.current = sdk;
      await voice.start(sdk);
    } catch (cause) { if (attempt === beginGeneration.current) setError(cause instanceof Error ? cause.message : text.unavailable); }
    finally { if (attempt === beginGeneration.current) setCreating(false); }
  };

  const showingCall = !ended && !minimised && (creating || voice.state.phase !== "idle");
  return (
    <div className={styles.landing}>
      <div className={styles.announcement}>
        <AudioLines size={19} aria-hidden />
        <span>{text.announcement}</span>
        <a href="#how-it-works" className={styles.discover}>{text.discover}<ArrowUpRight size={13} aria-hidden /></a>
      </div>
      <div className={styles.pageFrame}>
      <header className={styles.header}>
        <Link href="/" aria-label="Callvi" className={styles.wordmark}><AudioLines aria-hidden />callvi</Link>
        <nav aria-label={text.menu} className={styles.navigation}>
          <a href="#how-it-works">{text.how}</a>
          <Link href="/courses">{text.courses}</Link>
          <Link href="/progress">{text.progress}</Link>
        </nav>
        <div className={styles.headerActions}>
          <button type="button" aria-label={text.settings} aria-expanded={menu === "settings"} onClick={() => setMenu(menu === "settings" ? null : "settings")} className={styles.settingsButton}><Globe2 size={16} aria-hidden /><span>{language === "ta-IN" ? "தமிழ்" : "English"}</span><SlidersHorizontal size={14} aria-hidden /></button>
          <button type="button" disabled={!hydrated || !ready || creating} onClick={() => { if (active) setMinimised(false); else { voice.reset(); void begin(); } }} className={styles.headerCta}>{text.start}<ArrowUpRight size={15} aria-hidden /></button>
          <button type="button" aria-label={text.menu} aria-expanded={menu === "learning"} onClick={() => setMenu(menu === "learning" ? null : "learning")} className={styles.mobileMenu}><Menu size={21} /></button>
        </div>
      </header>

      {menu ? (
        <section className={`absolute top-36 z-40 w-[min(320px,calc(100vw-3rem))] rounded-2xl border border-line bg-white p-5 shadow-md ${menu === "learning" ? "left-6 sm:left-10" : "right-6 sm:right-10"}`} aria-label={menu === "learning" ? text.menu : text.settings}>
          <div className="mb-5 flex items-center justify-between"><h2 className="text-sm font-semibold">{menu === "learning" ? text.menu : text.settings}</h2><button type="button" aria-label={text.close} onClick={() => setMenu(null)}><X className="size-4" /></button></div>
          {menu === "learning" ? (
            <nav className="flex flex-col gap-1">{[["/progress", text.progress], ["/courses", text.courses], ["/privacy", text.privacy]].map(([href, label]) => <Link key={href} href={href} className="flex items-center justify-between rounded-lg px-3 py-3 text-sm hover:bg-sunken">{label}<ArrowUpRight className="size-4 text-subtle" /></Link>)}</nav>
          ) : (
            <div className="flex flex-col gap-5"><div><p className="mb-3 text-xs text-subtle">{text.language}</p><form action={setUiLanguage} className="flex gap-2"><input type="hidden" name="next" value="/" />{(["ta-IN", "en-IN"] as const).map((code) => <button key={code} type="submit" name="language" value={code} className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm ${language === code ? "border-accent bg-accent-soft text-accent" : "border-line"}`}>{code === "ta-IN" ? "தமிழ்" : "English"}{language === code ? <Check className="size-3.5" /> : null}</button>)}</form></div><Link href="/privacy" className="flex items-center gap-2 text-sm"><ShieldCheck className="size-4" />{text.privacy}</Link><p className="text-xs leading-relaxed text-subtle">{text.memory}</p></div>
          )}
        </section>
      ) : null}

      <main id="main" className={styles.main}>
        {deleted ? <p role="status" className="py-4 text-sm text-success">{language === "ta-IN" ? "உங்கள் தரவு நீக்கப்பட்டது." : "Your data has been deleted."}</p> : null}
        <section className={styles.hero}>
          <div><p className={styles.eyebrow}>{text.eyebrow}</p><h1>{text.title}</h1></div>
          <p className={styles.heroDescription}>{text.body}</p>
        </section>

        <div className={styles.topicBar}>
          <div className={styles.topics}>
            <span><Store size={20} strokeWidth={1.6} aria-hidden />{text.business}</span>
            <span><Smartphone size={20} strokeWidth={1.6} aria-hidden />{text.digital}</span>
            <span><AudioLines size={20} strokeWidth={1.6} aria-hidden />{text.communication}</span>
          </div>
          <form className={styles.languagePill} aria-label={text.language} action={async (formData) => { formData.set("next", "/"); await setUiLanguage(formData); }}>{(["ta-IN", "en-IN"] as const).map((code) => <button key={code} type="submit" name="language" value={code} aria-pressed={language === code} className={language === code ? styles.selectedLanguage : ""}>{code === "ta-IN" ? "தமிழ்" : "English"}</button>)}</form>
        </div>

        <section id="start-learning" className={styles.voiceStage} aria-label={text.cardLabel}>
          <div className={styles.stageTexture} aria-hidden />
          <div className={styles.stageCaption} aria-hidden><span className={styles.liveDot} />{text.browser}</div>
          <div className={styles.callCard}>
            <div className={styles.cardEyebrow}><VoiceOrb level={minimised ? voice.state.level : 0} /><span>{text.cardLabel}</span></div>
            <h2>{ended ? text.sessionEnded : resumeTitle ? text.resume : text.cardTitle}</h2>
            <p className={styles.cardDescription}>{ended ? ended.saved ? text.saved : text.notSaved : resumeTitle ? resumeTitle : text.cardBody}</p>
            {ended?.summary ? <p className={styles.summary}>{ended.summary}</p> : null}
            {minimised && active ? (
              <button type="button" onClick={() => setMinimised(false)} className={styles.callButton}><Phone size={17} />{text.returnCall}<ArrowUpRight size={17} /></button>
            ) : (
              <button type="button" onClick={() => { voice.reset(); void begin(); }} disabled={!hydrated || !ready || creating} className={styles.callButton}><Phone size={17} />{ended ? text.again : resumeTitle ? text.continueCall : text.call}<ArrowUpRight size={17} aria-hidden /></button>
            )}
            <p className={styles.callHint}>{ready ? text.firstCall : text.unavailable}</p>
            {phoneNumber && <p className="mt-3"><a className="underline" href={`tel:${phoneNumber.replace(/[^\d+]/g, "")}`}>{text.dial} {phoneNumber}</a></p>}
            <Link href="/practice" className="mt-3 inline-block text-sm underline">{text.textPractice}</Link>
            {error ? <p role="alert" className="mt-4 text-sm text-danger">{error}</p> : null}
            {resumeSummary && !ended ? <p className="sr-only">{resumeSummary}</p> : null}
          </div>
          <p className={styles.stageFootnote}>{text.hint}</p>
        </section>

        <section id="how-it-works" className={styles.howSection}>
          <div className={styles.sectionIntro}><h2>{text.sectionTitle}</h2><p>{text.sectionBody}</p></div>
          <div className={styles.steps}>
            {[[text.stepOne, text.stepOneBody], [text.stepTwo, text.stepTwoBody], [text.stepThree, text.stepThreeBody]].map(([title, description], index) => <article key={title}><span className={styles.stepNumber}>0{index + 1}</span><h3>{title}</h3><p>{description}</p></article>)}
          </div>
          <Link href="/courses" className={styles.courseLink}>{text.courses}<ArrowRight size={17} aria-hidden /></Link>
        </section>
      </main>
      <footer className={styles.footer}><Link href="/" className={styles.wordmark}><AudioLines aria-hidden />callvi</Link><p>{text.purpose}</p><Link href="/privacy">{text.privacy}<ArrowUpRight size={14} aria-hidden /></Link></footer>
      </div>
      {!showingCall ? <button type="button" className={styles.floatingCall} disabled={!hydrated || !ready || creating} onClick={() => { if (active) setMinimised(false); else { voice.reset(); void begin(); } }} aria-label={active ? text.returnCall : text.voiceChat}><VoiceOrb level={minimised ? voice.state.level : 0} /><span>{active ? text.returnCall : text.voiceChat}</span></button> : null}

      {showingCall ? <CallScreen state={creating && voice.state.phase === "idle" ? { ...initialVoiceState, phase: "connecting" } : voice.state} copy={copy} name={copy.app.name} conceptTitle={liveTitle} fallbackHref="/learn" onMute={voice.toggleMute} onToggleOutput={voice.toggleOutput} outputMuted={voice.outputMuted} onEnd={() => { ++beginGeneration.current; setCreating(false); void voice.stop(); }} onRetry={() => { voice.reset(); const session = sessionRef.current; if (session) void voice.start(session); else void begin(); }} onClose={voice.reset} onMinimise={() => setMinimised(true)} /> : null}
    </div>
  );
}
