import { build } from "esbuild";
import { cp, mkdir } from "node:fs/promises";

await mkdir("dist/rehearsal-demo", { recursive: true });
await build({
  entryPoints: ["demo/main.tsx"], outdir: "dist/rehearsal-demo",
  bundle: true, minify: true, format: "esm", jsx: "automatic", target: "es2022",
  loader: { ".woff2": "file", ".woff": "file" }, assetNames: "fonts/[name]-[hash]",
  define: { "process.env.NODE_ENV": '"production"' },
});
await cp("demo/index.html", "dist/rehearsal-demo/index.html");
await cp("public/rehearsal", "dist/rehearsal-demo/rehearsal", { recursive: true });
await cp("demo/walkthrough.mp4", "dist/rehearsal-demo/walkthrough.mp4");
