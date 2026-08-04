import { cp, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "dist");

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(path.join(root, "manifest.json"), path.join(output, "manifest.json"));
for (const file of ["background.js", "web-bridge.js", "sync-overlay.js", "sync-overlay.css", "bilibili-content.js", "popup.html", "popup.css", "popup.js"]) {
  await cp(path.join(root, "src", file), path.join(output, file));
}

console.log(`Built unpacked extension at ${output}`);
