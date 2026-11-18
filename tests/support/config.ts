import { buildConfig, setConfigForTests, type AppConfig } from "@/server/config/env";

export const TEST_TOOL_SECRET_BROWSER = "browser-tool-secret-for-tests-0123456789abcdef";
export const TEST_TOOL_SECRET_PHONE = "phone-tool-secret-for-tests-0123456789abcdefgh";

/** A test configuration with every provider value set (all fake, local only). */
export function testConfig(overrides: Record<string, string> = {}): AppConfig {
  const config = buildConfig({
    NODE_ENV: "test",
    APP_SIGNING_SECRET: "test-signing-secret-0123456789abcdef-0123456789",
    PHONE_HASH_SECRET: "test-phone-hash-secret-0123456789abcdef-012345",
    SARVAM_API_KEY: "test-api-key",
    SARVAM_ORG_ID: "org-test",
    SARVAM_WORKSPACE_ID: "ws-test",
    SARVAM_WEB_APP_ID: "app-web",
    SARVAM_PHONE_APP_ID: "app-phone",
    SARVAM_TOOL_SECRET_BROWSER: TEST_TOOL_SECRET_BROWSER,
    SARVAM_TOOL_SECRET_PHONE: TEST_TOOL_SECRET_PHONE,
    ...overrides,
  });
  setConfigForTests(config);
  return config;
}
