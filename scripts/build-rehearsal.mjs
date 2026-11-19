// Builds the public preview: a static, keyless copy of three lessons that runs
// the same exercises and rubric as the app. Run through `npm run build:rehearsal`,
// which first serialises the preview content (scripts/extract-preview.ts).
import { build } from "esbuild";
import { cp, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const generatedContent = resolve("dist/preview-data/skill-preview.js");

/**
 * Swaps the content module for its pre-validated, serialised form. Matching the
 * one import path rather than aliasing broadly keeps every other module, and
 * the grading code in particular, byte-for-byte the code the app runs.
 */
const prebuiltContent = {
  name: "prebuilt-preview-content",
  setup(builder) {
    builder.onResolve({ filter: /^@\/content\/skill-preview$/ }, () => ({ path: generatedContent }));
  },
};

await mkdir("dist/rehearsal-demo", { recursive: true });
const result = await build({
  entryPoints: ["demo/main.tsx"], outdir: "dist/rehearsal-demo",
  bundle: true, minify: true, format: "esm", jsx: "automatic", target: "es2022",
  loader: { ".woff2": "file", ".woff": "file" }, assetNames: "fonts/[name]-[hash]",
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [prebuiltContent],
  metafile: true,
});

// The swap only helps if the heavy modules are truly gone. Fail loudly if a
// future import drags the schema library or a whole course back in.
const bundled = Object.keys(result.metafile.inputs);
const leaked = bundled.filter(path => /node_modules\/zod\/|src\/content\/(courses|schema)/.test(path));
if (leaked.length) throw new Error(`The preview bundle pulled in content it should not ship:\n${leaked.join("\n")}`);

await cp("demo/index.html", "dist/rehearsal-demo/index.html");
await cp("public/rehearsal", "dist/rehearsal-demo/rehearsal", { recursive: true });
await cp("demo/walkthrough.mp4", "dist/rehearsal-demo/walkthrough.mp4");
await cp("docs/media/callvi-cover.webp", "dist/rehearsal-demo/callvi-cover.webp");
await cp("demo/call-sample.html", "dist/rehearsal-demo/call-sample.html");
