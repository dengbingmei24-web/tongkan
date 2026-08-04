import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const signalingRoot = path.join(root, "apps", "signaling");
const webRoot = path.join(root, "apps", "web");
const wranglerBin = path.join(signalingRoot, "node_modules", "wrangler", "bin", "wrangler.js");
const vitestBin = path.join(root, "node_modules", "vitest", "vitest.mjs");
const liveSmoke = path.join(signalingRoot, "scripts", "live-smoke.mjs");
const signalingOrigin = process.env.TONGKAN_SIGNALING_HTTP ?? "http://127.0.0.1:8787";
const signalingUrl = new URL(signalingOrigin);
const port = signalingUrl.port || (signalingUrl.protocol === "https:" ? "443" : "80");
const serverLog = [];

console.log(`Starting temporary signaling service at ${signalingOrigin}`);
const server = spawn(process.execPath, [wranglerBin, "dev", "--ip", signalingUrl.hostname, "--port", port], {
  cwd: signalingRoot,
  env: process.env,
  stdio: ["ignore", "pipe", "pipe"],
});

server.stdout.on("data", (chunk) => serverLog.push(String(chunk)));
server.stderr.on("data", (chunk) => serverLog.push(String(chunk)));

try {
  await waitForService(server, signalingOrigin, 30_000);
  console.log("Signaling service is ready.");

  await runNode(liveSmoke, [], signalingRoot, {
    TONGKAN_SIGNALING_HTTP: signalingOrigin,
  });

  await runNode(vitestBin, ["run", "--config", "vitest.live.config.ts", "--configLoader", "runner"], webRoot, {
    VITE_SIGNALING_HTTP: signalingOrigin,
    VITE_SIGNALING_WS: signalingOrigin.replace(/^http/, "ws"),
  });

  console.log("Live signaling integration tests passed.");
} catch (error) {
  if (serverLog.length > 0) {
    console.error("\nWrangler output:\n" + serverLog.join("").trim());
  }
  throw error;
} finally {
  await stopServer(server);
}

async function waitForService(child, origin, timeoutMs) {
  const startedAt = Date.now();
  let lastError;

  while (Date.now() - startedAt < timeoutMs) {
    if (child.exitCode !== null) {
      throw new Error(`Signaling service exited before becoming ready (code ${child.exitCode}).`);
    }
    try {
      const response = await fetch(origin);
      if (response.ok) return;
      lastError = new Error(`Health check returned ${response.status}.`);
    } catch (error) {
      lastError = error;
    }
    await delay(250);
  }

  throw new Error(`Signaling service did not become ready within ${timeoutMs}ms.`, { cause: lastError });
}

function runNode(entry, args, cwd, extraEnv) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [entry, ...args], {
      cwd,
      env: { ...process.env, ...extraEnv },
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${path.basename(entry)} failed with ${signal ?? `exit code ${code}`}.`));
    });
  });
}

async function stopServer(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    delay(5_000),
  ]);
  if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
}
