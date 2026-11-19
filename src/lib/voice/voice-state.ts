/**
 * Pure voice-session state model for the live room. The UI only ever shows
 * states reported by the provider SDK (or by the browser for microphone
 * errors); nothing is simulated.
 */

export type VoicePhase =
  "idle" | "requesting_mic" | "connecting" | "listening" | "agent_speaking" | "learner_speaking" | "ended" | "error";

export type VoiceErrorKind =
  | "mic_denied"
  | "mic_missing"
  | "mic_busy"
  | "auth"
  | "rate_limited"
  | "network"
  | "timeout"
  | "not_configured"
  | "unsupported"
  | "generic";

export interface TranscriptLine {
  id: number;
  role: "learner" | "companion";
  text: string;
}

export interface VoiceState {
  phase: VoicePhase;
  error: VoiceErrorKind | null;
  muted: boolean;
  transcript: TranscriptLine[];
  nextLineId: number;
  /** When the provider first reported a live connection (epoch ms). Drives the call timer. */
  connectedAt: number | null;
  /** Real input/output amplitude supplied by the active provider SDK. */
  level: number;
}

export const initialVoiceState: VoiceState = {
  phase: "idle",
  error: null,
  muted: false,
  transcript: [],
  nextLineId: 1,
  connectedAt: null,
  level: 0,
};

export type VoiceAction =
  | { type: "start_requested" }
  | { type: "mic_granted" }
  | { type: "sdk_state"; state: string; at?: number }
  | { type: "learner_speech"; speaking: boolean }
  | { type: "transcript"; role: string; text: string }
  | { type: "transcript_corrected"; original: string; corrected: string }
  | { type: "muted"; muted: boolean }
  | { type: "audio_level"; level: number }
  | { type: "ended" }
  | { type: "failed"; error: VoiceErrorKind }
  | { type: "reset" };

/** Transcript lines kept on screen (memory only; never persisted). */
const MAX_LINES = 200;

export function voiceReducer(state: VoiceState, action: VoiceAction): VoiceState {
  switch (action.type) {
    case "start_requested":
      return { ...initialVoiceState, phase: "requesting_mic" };
    case "mic_granted":
      return { ...state, phase: "connecting" };
    case "sdk_state": {
      if (state.phase === "ended" || state.phase === "error") return state;
      const live = action.state === "connected" || action.state === "listening" || action.state === "speaking";
      const connectedAt = state.connectedAt ?? (live && action.at !== undefined ? action.at : null);
      // AgentState values from sarvam-conv-ai-sdk: idle | connecting | connected | listening | speaking | error
      switch (action.state) {
        case "connecting":
          return { ...state, phase: "connecting" };
        case "connected":
          return { ...state, phase: "connecting", connectedAt };
        case "listening":
          return {
            ...state,
            phase: state.phase === "learner_speaking" ? "learner_speaking" : "listening",
            connectedAt,
          };
        case "speaking":
          return { ...state, phase: "agent_speaking", connectedAt };
        case "error":
          return { ...state, phase: "error", error: state.error ?? "generic" };
        default:
          return state;
      }
    }
    case "learner_speech":
      if (state.phase !== "listening" && state.phase !== "learner_speaking") return state;
      return { ...state, phase: action.speaking ? "learner_speaking" : "listening" };
    case "transcript": {
      const role: TranscriptLine["role"] | null =
        action.role === "user" ? "learner" : action.role === "bot" ? "companion" : null;
      const text = action.text.trim();
      if (!role || !text) return state;
      const transcript = [...state.transcript, { id: state.nextLineId, role, text }].slice(-MAX_LINES);
      return { ...state, transcript, nextLineId: state.nextLineId + 1 };
    }
    case "transcript_corrected": {
      const index = state.transcript.findLastIndex(
        (line) => line.role === "companion" && line.text === action.original.trim(),
      );
      if (index < 0) return state;
      const corrected = action.corrected.trim();
      const transcript = corrected
        ? state.transcript.map((line, i) => (i === index ? { ...line, text: corrected } : line))
        : state.transcript.filter((_, i) => i !== index);
      return { ...state, transcript };
    }
    case "muted":
      return { ...state, muted: action.muted };
    case "audio_level":
      return { ...state, level: Math.max(0, Math.min(1, action.level)) };
    case "ended":
      return state.phase === "error" ? state : { ...state, phase: "ended" };
    case "failed":
      return { ...state, phase: "error", error: action.error };
    case "reset":
      return initialVoiceState;
  }
}

/** Map a browser or SDK error to a learner-facing category. */
export function classifyVoiceError(error: unknown): VoiceErrorKind {
  if (typeof error === "object" && error !== null) {
    const name = "name" in error && typeof error.name === "string" ? error.name : "";
    const code = "code" in error && typeof error.code === "string" ? error.code : "";
    const status = "statusCode" in error && typeof error.statusCode === "number" ? error.statusCode : null;
    if (name === "NotAllowedError" || name === "SecurityError") return "mic_denied";
    if (name === "NotFoundError" && status === null && code === "") return "mic_missing";
    if (name === "OverconstrainedError") return "mic_missing";
    if (name === "NotReadableError" || name === "AbortError") return "mic_busy";
    if (name === "AuthenticationError" || name === "ForbiddenError" || status === 401 || status === 403) return "auth";
    if (name === "RateLimitError" || status === 429) return "rate_limited";
    if (status === 503 || status === 502 || status === 504) return "network";
    if (status === 501) return "not_configured";
    if (name === "TypeError" || name === "NetworkError") return "network";
  }
  return "generic";
}

/** Elapsed call time as m:ss or h:mm:ss. */
export function formatCallDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

export function isActivePhase(phase: VoicePhase): boolean {
  return phase === "connecting" || phase === "listening" || phase === "agent_speaking" || phase === "learner_speaking";
}
