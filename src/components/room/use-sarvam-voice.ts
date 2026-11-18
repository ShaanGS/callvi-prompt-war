"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import type { ConversationAgent, InteractionConfig } from "sarvam-conv-ai-sdk/browser";

type SdkLanguage = NonNullable<InteractionConfig["initial_language_name"]>;
import { classifyVoiceError, initialVoiceState, voiceReducer } from "@/lib/voice/voice-state";

/** Browser voice-session configuration issued by the server (no secrets). */
export interface VoiceSdkConfig {
  org_id: string;
  workspace_id: string;
  app_id: string;
  version?: number;
  user_identifier: string;
  user_identifier_type: "custom";
  initial_language_name: "Tamil" | "English";
  proxy_base_url: string;
}

const CONNECT_TIMEOUT_SECONDS = 10;

/** Runtime-checked narrowing to the SDK's language enum (no type cast). */
function isSdkLanguage(value: string): value is SdkLanguage {
  return value === "Tamil" || value === "English";
}

/**
 * Sarvam browser voice session. Verified against sarvam-conv-ai-sdk 0.0.42:
 * `new ConversationAgent({ apiKey, baseUrl, config, audioInterface, ...callbacks })`,
 * `start()`, `waitForConnect(seconds)`, `stop()`, `mute()`, `unmute()`.
 * The API key is never in the browser: `baseUrl` points at this app's
 * authenticated proxy, which adds the key server-side.
 */
export function useSarvamVoice(config: VoiceSdkConfig | null, onEnded: () => void) {
  const [state, dispatch] = useReducer(voiceReducer, initialVoiceState);
  const agentRef = useRef<ConversationAgent | null>(null);
  const endedRef = useRef(false);
  /** Set once the provider reports a live call; only a call that connected can end the learning session. */
  const connectedRef = useRef(false);
  /** Set while tearing down a failed attempt, so the SDK's end callback is not treated as a finished call. */
  const failingRef = useRef(false);
  const onEndedRef = useRef(onEnded);

  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  const finish = useCallback(() => {
    if (endedRef.current || failingRef.current) return;
    agentRef.current = null;
    if (!connectedRef.current) {
      // Cancelled before it connected: back to the call button, the session stays open.
      dispatch({ type: "reset" });
      return;
    }
    endedRef.current = true;
    dispatch({ type: "ended" });
    onEndedRef.current();
  }, []);

  /** Tear down a failed attempt without ending the learning session. */
  const fail = useCallback(async (agent: ConversationAgent | null, error: Parameters<typeof classifyVoiceError>[0] | "timeout") => {
    failingRef.current = true;
    agentRef.current = null;
    if (agent) await agent.stop().catch(() => undefined);
    failingRef.current = false;
    dispatch({ type: "failed", error: error === "timeout" ? "timeout" : classifyVoiceError(error) });
  }, []);

  const start = useCallback(async () => {
    if (!config || agentRef.current) return;
    endedRef.current = false;
    connectedRef.current = false;
    dispatch({ type: "start_requested" });

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof AudioContext === "undefined") {
      dispatch({ type: "failed", error: "unsupported" });
      return;
    }
    // Ask for the microphone first so permission problems get a precise message.
    try {
      const probe = await navigator.mediaDevices.getUserMedia({ audio: true });
      probe.getTracks().forEach((track) => track.stop());
    } catch (e) {
      dispatch({ type: "failed", error: classifyVoiceError(e) });
      return;
    }
    dispatch({ type: "mic_granted" });

    try {
      const sdk = await import("sarvam-conv-ai-sdk/browser");
      const languageName: string = config.initial_language_name;
      const language = isSdkLanguage(languageName) ? languageName : undefined;
      const agent = new sdk.ConversationAgent({
        apiKey: "",
        baseUrl: config.proxy_base_url,
        config: {
          org_id: config.org_id,
          workspace_id: config.workspace_id,
          app_id: config.app_id,
          ...(config.version ? { version: config.version } : {}),
          user_identifier: config.user_identifier,
          user_identifier_type: config.user_identifier_type,
          interaction_type: sdk.InteractionType.CALL,
          input_sample_rate: 16000,
          output_sample_rate: 16000,
          ...(language ? { initial_language_name: language } : {}),
        },
        audioInterface: new sdk.BrowserAudioInterface(),
        stateCallback: (next) => {
          if (next === "connected" || next === "listening" || next === "speaking") connectedRef.current = true;
          dispatch({ type: "sdk_state", state: next, at: Date.now() });
        },
        transcriptCallback: async (msg) => dispatch({ type: "transcript", role: msg.role, text: msg.content }),
        eventCallback: async (event) => {
          const type: string = event.type;
          if (type === "server.event.user_speech_start") dispatch({ type: "learner_speech", speaking: true });
          else if (type === "server.event.user_speech_end") dispatch({ type: "learner_speech", speaking: false });
        },
        endCallback: async () => finish(),
      });
      agentRef.current = agent;
      await agent.start();
      const connected = await agent.waitForConnect(CONNECT_TIMEOUT_SECONDS).catch(() => false);
      if (!connected) await fail(agent, "timeout");
    } catch (e) {
      await fail(agentRef.current, e);
    }
  }, [config, finish, fail]);

  const stop = useCallback(async () => {
    const agent = agentRef.current;
    if (agent) await agent.stop().catch(() => undefined);
    finish();
  }, [finish]);

  const toggleMute = useCallback(() => {
    const agent = agentRef.current;
    if (!agent) return;
    if (agent.isMuted()) agent.unmute();
    else agent.mute();
    dispatch({ type: "muted", muted: agent.isMuted() });
  }, []);

  const reset = useCallback(() => {
    endedRef.current = false;
    connectedRef.current = false;
    dispatch({ type: "reset" });
  }, []);

  // Release the microphone and socket if the learner navigates away.
  useEffect(() => {
    return () => {
      const agent = agentRef.current;
      agentRef.current = null;
      if (agent) void agent.stop().catch(() => undefined);
    };
  }, []);

  return { state, start, stop, toggleMute, reset };
}
