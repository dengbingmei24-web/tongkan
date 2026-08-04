import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "dist");

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
const manifest = JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8"));
const bridgeScript = manifest.content_scripts.find((entry) => entry.js?.includes("web-bridge.js"));
if (!bridgeScript) throw new Error("manifest.json is missing the web bridge content script.");
bridgeScript.matches = readAllowedWebOrigins().map((origin) => `${origin}/*`);
await writeFile(path.join(output, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
for (const file of ["background.js", "web-bridge.js", "sync-overlay.js", "sync-overlay.css", "bilibili-content.js", "popup.html", "popup.css", "popup.js"]) {
  await cp(path.join(root, "src", file), path.join(output, file));
}

console.log(`Built unpacked extension at ${output}`);

function readAllowedWebOrigins() {
  const configured = process.env.TONGKAN_EXTENSION_WEB_ORIGINS;
  const values = configured
    ? configured.split(",")
    : ["http://localhost:5173", "http://127.0.0.1:5173"];
  const origins = values.map((value) => normalizeOrigin(value.trim())).filter(Boolean);
  if (origins.length === 0) throw new Error("TONGKAN_EXTENSION_WEB_ORIGINS must contain at least one HTTP(S) origin.");
  return [...new Set(origins)];
}

function normalizeOrigin(value) {
  if (!value) return null;
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Invalid extension Web origin: ${value}`);
  }
  if (!["http:", "https:"].includes(url.protocol)) throw new Error(`Extension Web origin must use HTTP(S): ${value}`);
  if (url.username || url.password || url.search || url.hash || (url.pathname && url.pathname !== "/")) {
    throw new Error(`Extension Web origin must not contain credentials, a path, query, or fragment: ${value}`);
  }
  return url.origin;
}
