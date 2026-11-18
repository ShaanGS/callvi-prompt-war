/** Client-safe connection settings; provider API keys never enter these types. */
export interface SarvamVoiceConfig {
  provider?: "sarvam";
  org_id: string;
  workspace_id: string;
  app_id: string;
  version?: number;
  user_identifier: string;
  user_identifier_type: "custom";
  initial_language_name: "Tamil" | "English";
  proxy_base_url: string;
}

export interface ElevenLabsVoiceConfig {
  provider: "elevenlabs";
  sessionId: string;
  language: "ta" | "en";
}

export type BrowserVoiceConfig = SarvamVoiceConfig | ElevenLabsVoiceConfig;
