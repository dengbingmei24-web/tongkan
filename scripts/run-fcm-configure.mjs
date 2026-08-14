import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.join(scriptsDirectory, "configure-fcm.ps1");
const forwarded = process.argv.slice(2);
while (forwarded[0] === "--") forwarded.shift();

const result = spawnSync(
  "powershell.exe",
  ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath, ...forwarded],
  { stdio: "inherit" },
);

if (result.error) {
  console.error(`Unable to start FCM configuration: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
