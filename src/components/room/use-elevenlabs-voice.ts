"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { Conversation } from "@elevenlabs/client";
import { z } from "zod";
import type { ElevenLabsVoiceConfig } from "@/lib/voice/config";
import { classifyVoiceError, initialVoiceState, voiceReducer } from "@/lib/voice/voice-state";
import { isActivePhase, type VoiceErrorKind } from "@/lib/voice/voice-state";
import { callRoomTool } from "./room-api";

const connectionSchema = z.object({
  ok: z.literal(true),
  connection: z.object({
    signedUrl: z.url(),
    language: z.enum(["ta", "en"]),
    toolNames: z.array(z.string()),
    dynamicVariables: z.record(z.string(), z.string()),
  }),
});

/** Real audio and tool calls through the official SDK; tools stay on this app's origin. */
export function useElevenLabsVoice(config: ElevenLabsVoiceConfig | null, onEnded: () => void) {
  const [state, dispatch] = useReducer(voiceReducer, initialVoiceState);
  const [outputMuted, setOutputMuted] = useState(false);
  const conversationRef = useRef<Conversation | null>(null);
  const generation = useRef(0);
  const busy = useRef(false);
  const connected = useRef(false);
  const ended = useRef(false);
  const muted = useRef(false);
  const onEndedRef = useRef(onEnded);
  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  const finish = useCallback(() => {
    conversationRef.current = null;
    busy.current = false;
    if (ended.current) return;
    ended.current = true;
    if (connected.current) {
      dispatch({ type: "ended" });
      onEndedRef.current();
    } else dispatch({ type: "reset" });
  }, []);

  const fail = useCallback(async (error: VoiceErrorKind) => {
    ++generation.current;
    busy.current = false;
    const conversation = conversationRef.current;
    conversationRef.current = null;
    dispatch({ type: "failed", error });
    if (conversation) await conversation.endSession().catch(() => undefined);
  }, []);

  const start = useCallback(
    async (overrideConfig?: ElevenLabsVoiceConfig) => {
      const settings = overrideConfig ?? config;
      if (!settings || busy.current || conversationRef.current) return;
      busy.current = true;
      connected.current = false;
      ended.current = false;
      muted.current = false;
      setOutputMuted(false);
      const attempt = ++generation.current;
      dispatch({ type: "start_requested" });
      try {
        if (!navigator.mediaDevices?.getUserMedia || typeof AudioContext === "undefined") {
          busy.current = false;
          dispatch({ type: "failed", error: "unsupported" });
          return;
        }
        const probe = await navigator.mediaDevices.getUserMedia({ audio: true });
        probe.getTracks().forEach((track) => track.stop());
        if (attempt !== generation.current) return;
        dispatch({ type: "mic_granted" });
        const [sdk, response] = await Promise.all([
          import("@elevenlabs/client"),
          fetch(`/api/voice/elevenlabs/sessions/${settings.sessionId}/connection`, {
            method: "POST",
            signal: AbortSignal.timeout(20_000),
          }),
        ]);
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw { statusCode: response.status };
        const { connection } = connectionSchema.parse(payload);
        if (attempt !== generation.current) return;
        const clientTools: Record<string, (parameters: unknown) => Promise<string>> = {};
        for (const name of connection.toolNames) {
          clientTools[name] = async (parameters) => {
            if (attempt !== generation.current)
              return JSON.stringify({ ok: false, saved: false, error: { message: "The call has ended." } });
            const args = z.record(z.string(), z.unknown()).parse(parameters ?? {});
            try {
              // Separate spoken attempts may contain identical words. Scope
              // replay protection to this invocation, rather than the answer.
              const actionKey = name === "record_practice_attempt" ? crypto.randomUUID() : undefined;
              const result = await callRoomTool(settings.sessionId, name, args, actionKey);
              return JSON.stringify(result.response);
            } catch {
              return JSON.stringify({
                ok: false,
                saved: false,
                error: { message: "This action failed. Do not say it was saved." },
              });
            }
          };
        }
        const conversation = await sdk.Conversation.startSession({
          signedUrl: connection.signedUrl,
          connectionType: "websocket",
          textOnly: false,
          userId: settings.sessionId,
          dynamicVariables: connection.dynamicVariables,
          overrides: { agent: { language: connection.language } },
          clientTools,
          onConnect: () => {
            if (attempt !== generation.current) return;
            connected.current = true;
            dispatch({ type: "sdk_state", state: "listening", at: Date.now() });
          },
          onModeChange: ({ mode }) => {
            if (attempt === generation.current)
              dispatch({ type: "sdk_state", state: mode === "speaking" ? "speaking" : "listening", at: Date.now() });
          },
          onMessage: ({ role, message }) => {
            if (attempt === generation.current)
              dispatch({ type: "transcript", role: role === "agent" ? "bot" : "user", text: message });
          },
          onInterruption: () => {
            if (attempt === generation.current) dispatch({ type: "sdk_state", state: "listening" });
          },
          onAgentResponseCorrection: ({ original_agent_response, corrected_agent_response }) => {
            if (attempt === generation.current)
              dispatch({
                type: "transcript_corrected",
                original: original_agent_response,
                corrected: corrected_agent_response,
              });
          },
          onVadScore: ({ vadScore }) => {
            if (attempt === generation.current) dispatch({ type: "learner_speech", speaking: vadScore > 0.4 });
          },
          onDisconnect: (details) => {
            if (attempt !== generation.current) return;
            if (details.reason === "error") void fail("network");
            else finish();
          },
          onError: () => {
            if (attempt === generation.current) void fail("network");
          },
        });
        if (attempt !== generation.current) {
          await conversation.endSession();
          return;
        }
        conversationRef.current = conversation;
        busy.current = false;
      } catch (error) {
        if (attempt !== generation.current) return;
        busy.current = false;
        const conversation = conversationRef.current;
        conversationRef.current = null;
        ++generation.current;
        if (conversation) await conversation.endSession().catch(() => undefined);
        dispatch({ type: "failed", error: classifyVoiceError(error) });
      }
    },
    [config, finish, fail],
  );

  const stop = useCallback(async () => {
    ++generation.current;
    const conversation = conversationRef.current;
    conversationRef.current = null;
    if (conversation) await conversation.endSession().catch(() => undefined);
    finish();
  }, [finish]);

  const toggleMute = useCallback(() => {
    if (!conversationRef.current) return;
    muted.current = !muted.current;
    conversationRef.current.setMicMuted(muted.current);
    dispatch({ type: "muted", muted: muted.current });
  }, []);
  const reset = useCallback(() => {
    dispatch({ type: "reset" });
  }, []);
  const toggleOutput = useCallback(() => {
    setOutputMuted((current) => {
      conversationRef.current?.setVolume({ volume: current ? 1 : 0 });
      return !current;
    });
  }, []);
  useEffect(() => {
    if (!isActivePhase(state.phase)) return;
    const timer = setInterval(() => {
      const conversation = conversationRef.current;
      if (!conversation || conversation.type !== "voice") return;
      const level = state.phase === "agent_speaking" ? conversation.getOutputVolume() : conversation.getInputVolume();
      dispatch({ type: "audio_level", level: muted.current && state.phase !== "agent_speaking" ? 0 : level * 3 });
    }, 60);
    return () => clearInterval(timer);
  }, [state.phase]);
  useEffect(
    () => () => {
      ++generation.current;
      const conversation = conversationRef.current;
      conversationRef.current = null;
      if (conversation) void conversation.endSession().catch(() => undefined);
    },
    [],
  );
  return { state, start, stop, toggleMute, reset, outputMuted, toggleOutput };
}
