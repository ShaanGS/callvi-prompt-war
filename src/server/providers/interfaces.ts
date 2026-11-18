import type { Db } from "../db/types";
import type { Channel, Learner, LearningSession } from "../domain/types";
import type { ToolResponse } from "../agent/orchestrator";

/**
 * Provider boundary. The voice provider supplies the real-time runtime
 * (audio, ASR, TTS, turn-taking, the conversational model loop). The
 * application supplies identity, curriculum, memory, progression, assessment
 * and persistence through tools. Provider-specific shapes stay in adapters.
 */

/** Configuration handed to the browser to open a voice session with the provider SDK. */
export interface BrowserVoiceSessionConfig {
  sessionId: string;
  sdk: {
    org_id: string;
    workspace_id: string;
    app_id: string;
    version?: number;
    user_identifier: string;
    user_identifier_type: "custom";
    initial_language_name: "Tamil" | "English";
    proxy_base_url: string;
  };
}

export interface VoiceSessionProvider {
  readonly name: "sarvam";
  /** Start a browser voice session for an authenticated learner. */
  createBrowserSession(db: Db, learner: Learner, opts: { courseId: string | null }): Promise<BrowserVoiceSessionConfig>;
  /** Server-side proxy for the SDK's signed-connection request (keeps the API key off the browser). */
  proxySignedUrl(request: Request, params: { orgId: string; workspaceId: string; appId: string }): Promise<Response>;
}

/** A provider tool callback, after authentication and caller resolution. */
export interface ResolvedToolCaller {
  channel: Extract<Channel, "browser" | "phone">;
  learner: Learner;
  session: LearningSession;
  interactionId: string;
  /** True for a phone caller whose number was unavailable (session-only, deleted at close). */
  anonymous: boolean;
}

export interface AgentRuntimeToolAdapter {
  handleToolCallback(request: Request, toolName: string): Promise<{ status: number; body: ToolResponse | { ok: false; error: { code: string; message: string } } }>;
}
