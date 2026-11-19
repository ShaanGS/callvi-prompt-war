import { describe, expect, it } from "vitest";
import { TOOLS } from "@/server/agent/tools";
import { elevenLabsInstructions, elevenLabsToolConfigs } from "@/server/providers/elevenlabs/agent-setup";
import { deleteSupabaseAuthUser } from "@/server/auth/supabase-admin";
import { createSupabaseServerClient } from "@/server/auth/supabase-server";
import { testConfig } from "../support/config";

describe("ElevenLabs agent configuration, generated from the tool registry", () => {
  const configs = elevenLabsToolConfigs();

  it("offers the agent exactly the tools the server implements, by the same names", () => {
    expect(configs.map((c) => c.name)).toEqual(TOOLS.map((t) => t.name));
  });

  it("describes every tool's input as an object schema the provider accepts", () => {
    for (const config of configs) {
      expect(config.parameters, config.name).toMatchObject({ type: "object" });
      expect(config).toMatchObject({ type: "client", expects_response: true });
    }
  });

  it("keeps enumerated choices, so the agent cannot invent a request type", () => {
    const lesson = configs.find((c) => c.name === "get_lesson_context")!;
    const request = (lesson.parameters as { properties: Record<string, { enum?: string[] }> }).properties.request;
    expect(request.enum).toEqual(["current", "different_explanation", "repeat", "move_on", "review"]);
  });

  it("instructs the agent from code, including that memory needs a recorded yes", () => {
    const text = elevenLabsInstructions();
    expect(text).toContain("set_memory_consent");
    expect(text).toContain("Never invent memory");
  });
});

describe("Supabase Auth when it is not configured", () => {
  it("offers no sign-in client rather than failing", async () => {
    testConfig();
    expect(await createSupabaseServerClient()).toBeNull();
  });

  it("reports that the auth user could not be deleted, so the learner is told", async () => {
    testConfig();
    expect(await deleteSupabaseAuthUser("00000000-0000-4000-8000-000000000000")).toBe(false);
  });
});
