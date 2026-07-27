import { access, readFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();

const workerPath = path.join(
  projectRoot,
  "dist",
  "server",
  "index.js",
);

const hostingPath = path.join(
  projectRoot,
  "dist",
  ".openai",
  "hosting.json",
);

await access(workerPath);
await access(hostingPath);

JSON.parse(await readFile(hostingPath, "utf8"));

const workerSource = await readFile(workerPath, "utf8");

const hasDefaultExport =
  /\bexport\s+default\b/.test(workerSource) ||
  /\bexport\s*\{[^}]*\bas\s+default\b[^}]*\}/s.test(
    workerSource,
  );

const hasFetchHandler =
  /\b(?:async\s+)?fetch\s*\(/.test(workerSource);

if (!hasDefaultExport || !hasFetchHandler) {
  throw new Error(
    "dist/server/index.js must export a default Worker with a fetch function.",
  );
}

console.log("Validated production artifact.");