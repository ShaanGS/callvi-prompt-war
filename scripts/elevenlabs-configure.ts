import { readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import { elevenLabsInstructions, elevenLabsToolConfigs } from "@/server/providers/elevenlabs/agent-setup";
import { loadEnv, run } from "./_shared";

run(async () => {
  const config = loadEnv();
  const key = config.elevenlabs.apiKey;
  if (!key) throw new Error("Add ELEVENLABS_API_KEY to .env.local first.");
  const api = async (path: string, body?: unknown, method = "POST") => {
    const response = await fetch(`https://api.elevenlabs.io${path}`, {
      method: body === undefined ? "GET" : method,
      headers: { "xi-api-key": key, "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(30_000),
    });
    const data: unknown = await response.json();
    if (!response.ok) throw new Error(`ElevenLabs ${path}: HTTP ${response.status}: ${JSON.stringify(data).slice(0,2500)}`);
    return data;
  };
  const toolList = z.object({ tools: z.array(z.object({ id: z.string(), tool_config: z.object({ name: z.string(), description: z.string().optional() }).loose() }).loose()) }).parse(await api("/v1/convai/tools"));
  const toolIds: string[] = [];
  for (const tool of elevenLabsToolConfigs()) {
    const existing = toolList.tools.find((t) => t.tool_config.name === tool.name && t.tool_config.description === tool.description);
    if (existing) toolIds.push(existing.id);
    else {
      const created = z.object({ id: z.string() }).parse(await api("/v1/convai/tools", { tool_config: tool }));
      toolIds.push(created.id);
    }
  }
  const agents = z.object({ agents: z.array(z.object({ agent_id: z.string(), name: z.string() })) }).parse(await api("/v1/convai/agents?page_size=100"));
  const existingAgent = config.elevenlabs.agentId ?? agents.agents.find((a) => a.name === "Callvi Learning Companion")?.agent_id;
  if (existingAgent) await api(`/v1/convai/agents/${encodeURIComponent(existingAgent)}`);
  const definition = {
    name: "Callvi Learning Companion",
    conversation_config: {
      agent: {
        first_message: "{{greeting}}", language: "en",
        dynamic_variables: { dynamic_variable_placeholders: { learner_language: "English", greeting: "Hi! I'm Callvi, your AI companion for practical skills, small business and everyday confidence. What would you like help with today?", call_context: "{}" } },
        prompt: {
          prompt: elevenLabsInstructions(), llm: "gpt-6-sol", reasoning_effort: "none", temperature: 0.2, max_tokens: 400,
          enable_parallel_tool_calls: false, tool_ids: toolIds,
          built_in_tools: { end_call: { type: "system", name: "end_call", params: { system_tool_type: "end_call" } } },
        },
      },
      tts: { voice_id: "wLIQpmGi7jT7aiEmDsE3", model_id: "eleven_v4_turbo", agent_output_audio_format: "pcm_24000", speed: 1, stability: 0.45, expressive_mode: true },
      turn: { turn_timeout: 15, turn_eagerness: "normal", speculative_turn: true },
      asr: { provider: "scribe_realtime", user_input_audio_format: "pcm_16000" },
      conversation: { max_duration_seconds: 1200, client_events: ["audio", "interruption", "user_transcript", "agent_response", "agent_response_correction", "client_tool_call", "vad_score"] },
    },
    platform_settings: {
      auth: { enable_auth: true },
      overrides: { conversation_config_override: { agent: { language: true }, conversation: { text_only: true } } },
      privacy: { record_voice: false, retention_days: 0, delete_audio: true, delete_transcript_and_pii: true },
    },
  };
  const result = existingAgent
    ? await api(`/v1/convai/agents/${encodeURIComponent(existingAgent)}`, definition, "PATCH")
    : await api("/v1/convai/agents/create", definition);
  const agentId = z.object({ agent_id: z.string() }).parse(result).agent_id;
  const verified = z.object({ agent_id: z.string(), conversation_config: z.object({ agent: z.object({ prompt: z.object({ tool_ids: z.array(z.string()) }) }) }) }).parse(await api(`/v1/convai/agents/${encodeURIComponent(agentId)}`));
  if (verified.conversation_config.agent.prompt.tool_ids.length !== toolIds.length) throw new Error("The configured tools could not be verified.");
  let local = await readFile(".env.local", "utf8");
  for (const [name, value] of Object.entries({ ELEVENLABS_AGENT_ID: agentId, BROWSER_VOICE_PROVIDER: "elevenlabs" })) {
    const pattern = new RegExp(`^${name}=.*$`, "m");
    local = pattern.test(local) ? local.replace(pattern, `${name}=${value}`) : `${local.trimEnd()}\n${name}=${value}\n`;
  }
  await writeFile(".env.local", local);
  console.log(`Configured ${verified.agent_id} with ${toolIds.length} client tools. API key stays server-side; audio recording is disabled.`);
});
