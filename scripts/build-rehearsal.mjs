// Builds the public preview: a static, keyless copy of three lessons that runs
// the same exercises and rubric as the app. Run through `npm run build:rehearsal`,
// which first serialises the preview content (scripts/extract-preview.ts).
import { build } from "esbuild";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

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

// A clean output directory, so stale hashed bundles from earlier builds never ship.
await rm("dist/rehearsal-demo", { recursive: true, force: true });
await mkdir("dist/rehearsal-demo", { recursive: true });
const result = await build({
  entryPoints: ["demo/main.tsx"],
  outdir: "dist/rehearsal-demo",
  bundle: true,
  minify: true,
  format: "esm",
  jsx: "automatic",
  target: "es2022",
  loader: { ".woff2": "file", ".woff": "file" },
  // Content-hashed names, so vercel.json can let phones cache them for a year
  // and a new build is still picked up at once.
  entryNames: "assets/[name]-[hash]",
  assetNames: "fonts/[name]-[hash]",
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [prebuiltContent],
  metafile: true,
});

// The swap only helps if the heavy modules are truly gone. Fail loudly if a
// future import drags the schema library or a whole course back in.
const bundled = Object.keys(result.metafile.inputs);
const leaked = bundled.filter((path) => /node_modules\/zod\/|src\/content\/(courses|schema)/.test(path));
if (leaked.length) throw new Error(`The preview bundle pulled in content it should not ship:\n${leaked.join("\n")}`);

// Point the pages at this build's hashed bundles.
const entry = Object.entries(result.metafile.outputs).find(([, o]) => o.entryPoint === "demo/main.tsx");
if (!entry?.[1].cssBundle) throw new Error("The preview build produced no script or stylesheet bundle.");
const site = resolve("dist/rehearsal-demo");
const scriptPath = `./${relative(site, resolve(entry[0]))}`;
const stylePath = `./${relative(site, resolve(entry[1].cssBundle))}`;
for (const page of ["index.html", "call-sample.html"]) {
  const html = (await readFile(`demo/${page}`, "utf8"))
    .replaceAll("./main.js", scriptPath)
    .replaceAll("./main.css", stylePath);
  if (html.includes("./main.")) throw new Error(`${page} still references an unhashed bundle.`);
  await writeFile(`dist/rehearsal-demo/${page}`, html);
}
await cp("public/rehearsal", "dist/rehearsal-demo/rehearsal", { recursive: true });
await cp("demo/walkthrough.mp4", "dist/rehearsal-demo/walkthrough.mp4");
await cp("docs/media/callvi-cover.webp", "dist/rehearsal-demo/callvi-cover.webp");
