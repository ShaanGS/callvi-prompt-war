import "server-only";
import { z } from "zod";

/**
 * Server configuration. Every value is validated at the boundary and secrets
 * are only ever read on the server. Nothing in this module may be imported by
 * a client component.
 */

const optionalString = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

const optionalSecret = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional()
  .refine((v) => v === undefined || v.length >= 32, "must be at least 32 characters");

const booleanFlag = z
  .enum(["true", "false", "1", "0", ""])
  .optional()
  .transform((v) => v === "true" || v === "1");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  VERCEL_ENV: optionalString,
  APP_URL: optionalString,

  DATABASE_URL: optionalString,
  LOCAL_DB_DIR: optionalString,

  NEXT_PUBLIC_SUPABASE_URL: optionalString,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalString,
  /** Optional, server-only: lets account deletion also remove the Supabase Auth user. */
  SUPABASE_SERVICE_ROLE_KEY: optionalString,

  APP_SIGNING_SECRET: optionalSecret,
  PHONE_HASH_SECRET: optionalSecret,

  DEV_AUTH_ENABLED: booleanFlag,

  BROWSER_VOICE_PROVIDER: z.enum(["sarvam", "elevenlabs"]).optional(),
  ELEVENLABS_API_KEY: optionalString,
  ELEVENLABS_AGENT_ID: optionalString,

  SARVAM_API_KEY: optionalString,
  SARVAM_API_BASE_URL: optionalString,
  SARVAM_ORG_ID: optionalString,
  SARVAM_WORKSPACE_ID: optionalString,
  SARVAM_WEB_APP_ID: optionalString,
  SARVAM_WEB_APP_VERSION: optionalString
    .refine((v) => v === undefined || /^[1-9]\d*$/.test(v), "must be a positive integer")
    .transform((v) => (v === undefined ? undefined : Number(v))),
  SARVAM_PHONE_APP_ID: optionalString,
  SARVAM_TOOL_SECRET_BROWSER: optionalSecret,
  SARVAM_TOOL_SECRET_PHONE: optionalSecret,

  PHONE_CHANNEL_VERIFIED: booleanFlag,
  PHONE_DISPLAY_NUMBER: optionalString,
});

export type RawEnv = z.infer<typeof envSchema>;

/** Development-only signing fallback. Refused in production. */
const DEV_ONLY_SIGNING_SECRET = "dev-only-signing-secret-not-for-production-use-0001";
const DEV_ONLY_PHONE_SECRET = "dev-only-phone-hash-secret-not-for-production-use-01";

export interface AppConfig {
  isProduction: boolean;
  isTest: boolean;
  appUrl: string | undefined;
  database:
    | { kind: "postgres"; url: string }
    | { kind: "pglite"; dataDir: string | undefined };
  auth: {
    supabase: { url: string; anonKey: string } | null;
    /** Server-only admin key, used solely to delete Auth users on account deletion. */
    supabaseServiceRoleKey: string | undefined;
    devAuthEnabled: boolean;
  };
  signingSecret: string;
  phoneHashSecret: string;
  sarvam: {
    apiKey: string | undefined;
    apiBaseUrl: string;
    orgId: string | undefined;
    workspaceId: string | undefined;
    webAppId: string | undefined;
    webAppVersion: number | undefined;
    phoneAppId: string | undefined;
    toolSecretBrowser: string | undefined;
    toolSecretPhone: string | undefined;
  };
  phone: { verified: boolean; displayNumber: string | undefined };
  browserVoiceProvider: "sarvam" | "elevenlabs";
  elevenlabs: { apiKey: string | undefined; agentId: string | undefined };
  /** Human-readable configuration problems (never contains secret values). */
  problems: string[];
}

export class ConfigurationError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Invalid configuration: ${problems.join("; ")}`);
    this.name = "ConfigurationError";
  }
}

export function buildConfig(source: Record<string, string | undefined>): AppConfig {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    throw new ConfigurationError(
      parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    );
  }
  const env = parsed.data;
  const isProduction = env.NODE_ENV === "production" || env.VERCEL_ENV === "production";
  const problems: string[] = [];

  if (isProduction) {
    const fatal: string[] = [];
    if (!env.DATABASE_URL) fatal.push("DATABASE_URL is required in production");
    if (!env.APP_SIGNING_SECRET) fatal.push("APP_SIGNING_SECRET is required in production");
    if (!env.PHONE_HASH_SECRET) fatal.push("PHONE_HASH_SECRET is required in production");
    if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      fatal.push("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required in production");
    }
    if (env.DEV_AUTH_ENABLED) fatal.push("DEV_AUTH_ENABLED must not be set in production");
    if (fatal.length > 0 && process.env.NEXT_PHASE !== "phase-production-build") {
      throw new ConfigurationError(fatal);
    }
    problems.push(...fatal);
  }

  const supabase =
    env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      ? { url: env.NEXT_PUBLIC_SUPABASE_URL, anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY }
      : null;

  // Development identity is only possible outside production, and only when
  // explicitly enabled or when no real identity provider is configured.
  const devAuthEnabled = !isProduction && (env.DEV_AUTH_ENABLED || supabase === null);

  if (!supabase) problems.push("Supabase Auth is not configured (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)");
  if (!env.DATABASE_URL) problems.push("DATABASE_URL is not set; using the embedded local development database");

  return {
    isProduction,
    isTest: env.NODE_ENV === "test",
    appUrl: env.APP_URL,
    database: env.DATABASE_URL
      ? { kind: "postgres", url: env.DATABASE_URL }
      : { kind: "pglite", dataDir: env.LOCAL_DB_DIR },
    auth: { supabase, supabaseServiceRoleKey: supabase ? env.SUPABASE_SERVICE_ROLE_KEY : undefined, devAuthEnabled },
    signingSecret: env.APP_SIGNING_SECRET ?? (isProduction ? "" : DEV_ONLY_SIGNING_SECRET),
    phoneHashSecret: env.PHONE_HASH_SECRET ?? (isProduction ? "" : DEV_ONLY_PHONE_SECRET),
    sarvam: {
      apiKey: env.SARVAM_API_KEY,
      apiBaseUrl: normaliseBaseUrl(env.SARVAM_API_BASE_URL ?? "https://apps.sarvam.ai/api/app-runtime/"),
      orgId: env.SARVAM_ORG_ID,
      workspaceId: env.SARVAM_WORKSPACE_ID,
      webAppId: env.SARVAM_WEB_APP_ID,
      webAppVersion: env.SARVAM_WEB_APP_VERSION,
      phoneAppId: env.SARVAM_PHONE_APP_ID,
      toolSecretBrowser: env.SARVAM_TOOL_SECRET_BROWSER,
      toolSecretPhone: env.SARVAM_TOOL_SECRET_PHONE,
    },
    phone: { verified: env.PHONE_CHANNEL_VERIFIED, displayNumber: env.PHONE_DISPLAY_NUMBER },
    browserVoiceProvider: env.BROWSER_VOICE_PROVIDER ?? (env.ELEVENLABS_AGENT_ID ? "elevenlabs" : "sarvam"),
    elevenlabs: { apiKey: env.ELEVENLABS_API_KEY, agentId: env.ELEVENLABS_AGENT_ID },
    problems,
  };
}

function normaliseBaseUrl(url: string): string {
  return url.endsWith("/") ? url : `${url}/`;
}

let cached: AppConfig | undefined;

export function getConfig(): AppConfig {
  cached ??= buildConfig(process.env);
  return cached;
}

/** Test hook: replace the cached configuration. */
export function setConfigForTests(config: AppConfig | undefined): void {
  cached = config;
}
