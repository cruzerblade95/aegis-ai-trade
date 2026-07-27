import { access, readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";

const projectRoot = process.cwd();
const workerPath = path.join(projectRoot, "dist", "server", "index.js");
const hostingPath = path.join(projectRoot, "dist", ".openai", "hosting.json");

await access(workerPath);
await access(hostingPath);
JSON.parse(await readFile(hostingPath, "utf8"));

const workerUrl = pathToFileURL(workerPath);
workerUrl.searchParams.set("aegis-validation", `${process.pid}-${Date.now()}`);
const worker = await import(workerUrl.href);

if (!worker.default || typeof worker.default.fetch !== "function") {
  throw new Error(
    "dist/server/index.js must export a default Worker with a fetch function.",
  );
}

console.log("Validated production artifact.");
