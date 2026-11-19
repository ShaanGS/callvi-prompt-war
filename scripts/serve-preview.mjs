// Serves the built public preview the way Vercel does, so tests exercise the
// deployed artifact rather than the Next app: same files, same headers.
//
// The headers are read from vercel.json rather than restated here. A test that
// passed against a copy of the policy would say nothing about the policy that
// actually ships.
//
//   node scripts/serve-preview.mjs [port]
import { createReadStream, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve("dist/rehearsal-demo");
const port = Number(process.argv[2] ?? process.env.PREVIEW_PORT ?? 4173);
const { headers: rules = [] } = JSON.parse(readFileSync("vercel.json", "utf8"));

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".svg": "image/svg+xml",
};

/** Vercel's `(.*)` wildcard, and nothing more: no other pattern syntax is used in vercel.json. */
const escape = (literal) => literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const matches = (source, path) => new RegExp(`^${source.split("(.*)").map(escape).join(".*")}$`).test(path);

createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = normalize(join(root, path === "/" ? "index.html" : path));
  // Refuse anything that resolves outside the build folder.
  if (!file.startsWith(root)) return void res.writeHead(403).end();

  let size;
  try {
    const stat = statSync(file);
    if (!stat.isFile()) throw new Error("not a file");
    size = stat.size;
  } catch {
    return void res.writeHead(404).end("Not found");
  }

  for (const rule of rules) {
    if (matches(rule.source, path)) for (const { key, value } of rule.headers) res.setHeader(key, value);
  }
  res.setHeader("Content-Type", types[extname(file)] ?? "application/octet-stream");
  res.setHeader("Accept-Ranges", "bytes");

  // Media elements request byte ranges; answering them keeps audio behaving as it does on Vercel.
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? "");
  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    res.writeHead(206, { "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": end - start + 1 });
    return void createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(200, { "Content-Length": size });
  createReadStream(file).pipe(res);
}).listen(port, () => console.log(`Preview on http://localhost:${port}`));
