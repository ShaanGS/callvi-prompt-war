import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  // Microphone is needed by the browser voice room on our own origin only.
  { key: "Permissions-Policy", value: "microphone=(self), camera=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  // Deliberately no script-src or connect-src: Next's hydration scripts would need
  // per-request nonces, and live voice opens WebSockets to Sarvam and ElevenLabs.
  // These directives close framing, <base> hijacking, plugins and foreign form
  // targets without risking either. The static preview's CSP is stricter (vercel.json).
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'",
  },
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
