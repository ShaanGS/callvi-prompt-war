import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  // Microphone is needed by the browser voice room on our own origin only.
  { key: "Permissions-Policy", value: "microphone=(self), camera=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  output: process.env.CALLVI_STANDALONE === "1" ? "standalone" : undefined,
  // Every learner-facing page is personalised and request-time, so the app uses
  // classic dynamic rendering rather than Cache Components.
  serverExternalPackages: ["@electric-sql/pglite", "postgres"],
  poweredByHeader: false,
  devIndicators: false,
  turbopack: {
    rules: {
      // Only the Tailwind entry needs this loader. Applying it to CSS Modules
      // renames them to .css.css and discards their scoped class exports.
      "globals.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
