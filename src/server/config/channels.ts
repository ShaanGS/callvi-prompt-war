import "server-only";
import type { AppConfig } from "./env";

export interface ChannelStatus {
  available: boolean;
  /** Names of missing configuration items. Never contains values. */
  missing: string[];
}

export interface ChannelReadiness {
  browserVoice: ChannelStatus;
  phone: ChannelStatus & { verified: boolean; displayNumber: string | undefined };
}

/**
 * Browser voice needs the Sarvam API key (server-side proxy), the agent
 * identifiers and the tool-callback secret the agent will present.
 *
 * Phone is only offered to learners once the team has verified a real inbound
 * call and a second-call resume test (PHONE_CHANNEL_VERIFIED=true).
 */
export function getChannelReadiness(config: AppConfig): ChannelReadiness {
  const s = config.sarvam;
  const sarvamBrowserMissing = [
    !s.apiKey && "SARVAM_API_KEY",
    !s.orgId && "SARVAM_ORG_ID",
    !s.workspaceId && "SARVAM_WORKSPACE_ID",
    !s.webAppId && "SARVAM_WEB_APP_ID",
    !s.toolSecretBrowser && "SARVAM_TOOL_SECRET_BROWSER",
  ].filter((v): v is string => typeof v === "string");

  const browserMissing = config.browserVoiceProvider === "elevenlabs"
    ? [!config.elevenlabs.apiKey && "ELEVENLABS_API_KEY", !config.elevenlabs.agentId && "ELEVENLABS_AGENT_ID"]
        .filter((v): v is string => typeof v === "string")
    : sarvamBrowserMissing;

  const phoneMissing = [
    !s.orgId && "SARVAM_ORG_ID",
    !s.workspaceId && "SARVAM_WORKSPACE_ID",
    !s.phoneAppId && "SARVAM_PHONE_APP_ID",
    !s.toolSecretPhone && "SARVAM_TOOL_SECRET_PHONE",
    !config.phone.verified && "PHONE_CHANNEL_VERIFIED (set only after a real inbound call and second-call resume test pass)",
    !config.phone.displayNumber && "PHONE_DISPLAY_NUMBER",
  ].filter((v): v is string => typeof v === "string");

  return {
    browserVoice: { available: browserMissing.length === 0, missing: browserMissing },
    phone: {
      available: phoneMissing.length === 0,
      missing: phoneMissing,
      verified: config.phone.verified,
      displayNumber: config.phone.verified ? config.phone.displayNumber : undefined,
    },
  };
}
