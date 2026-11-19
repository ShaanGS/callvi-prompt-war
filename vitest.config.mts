import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // `server-only` throws outside a React Server Components bundler; tests run on the server anyway.
      "server-only": path.resolve(import.meta.dirname, "tests/support/server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    pool: "forks",
    // Each integration worker starts a WebAssembly PostgreSQL instance.
    maxWorkers: 2,
    coverage: {
      provider: "v8",
      // The logic a grade or a learner's data depends on. UI components are
      // covered by the Playwright suites instead.
      include: ["src/server/**", "src/content/**", "src/lib/**"],
      // The agent evaluation harness runs scenarios rather than being one;
      // counting it would flatter the figure.
      exclude: ["src/server/agent/evaluation.ts"],
      reporter: ["text-summary", "html"],
      // Set just under the measured figures so coverage can only ratchet up.
      thresholds: { statements: 83, branches: 77, functions: 84, lines: 85 },
    },
  },
});
