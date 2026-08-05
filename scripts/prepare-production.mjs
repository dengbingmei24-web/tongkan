import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = readArgs(process.argv.slice(2));

if (args.help) {
  printHelp();
  process.exit(0);
}

const webOrigin = normalizeHttpsOrigin(args["web-origin"] ?? process.env.TONGKAN_WEB_ORIGIN, "网页地址");
const signalingOrigin = normalizeHttpsOrigin(
  args["signaling-origin"] ?? process.env.TONGKAN_SIGNALING_ORIGIN,
  "信令地址",
);
const iceServers = args["ice-servers"] ?? process.env.VITE_RTC_ICE_SERVERS ?? "";
validateIceServers(iceServers);

const releaseRoot = path.join(projectRoot, "release");
const webRelease = path.join(releaseRoot, "web");
const extensionRelease = path.join(releaseRoot, "extension-unpacked");
const extensionZip = path.join(releaseRoot, "tongkan-edge-extension.zip");

await rm(releaseRoot, { recursive: true, force: true });
await mkdir(releaseRoot, { recursive: true });

runPnpm(["--filter", "@tongkan/web", "build"], {
  VITE_SIGNALING_HTTP: signalingOrigin,
  VITE_SIGNALING_WS: signalingOrigin.replace(/^https:/, "wss:"),
  VITE_RTC_ICE_SERVERS: iceServers,
});
runPnpm(["--filter", "@tongkan/extension", "build"], {
  TONGKAN_EXTENSION_WEB_ORIGINS: webOrigin,
});

await cp(path.join(projectRoot, "apps", "web", "dist"), webRelease, { recursive: true });
await cp(path.join(projectRoot, "apps", "extension", "dist"), extensionRelease, { recursive: true });

const manifest = JSON.parse(await readFile(path.join(extensionRelease, "manifest.json"), "utf8"));
await writeFile(
  path.join(releaseRoot, "release-info.json"),
  `${JSON.stringify({
    createdAt: new Date().toISOString(),
    webOrigin,
    signalingOrigin,
    extensionVersion: manifest.version,
    turnConfigured: Boolean(iceServers),
  }, null, 2)}\n`,
  "utf8",
);

if (process.platform === "win32") {
  const sourcePattern = path.join(extensionRelease, "*");
  const command = [
    `Compress-Archive -Path '${escapePowerShell(sourcePattern)}'`,
    `-DestinationPath '${escapePowerShell(extensionZip)}'`,
    "-Force",
  ].join(" ");
  run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command]);
}

console.log("\n生产构建已准备完成：");
console.log(`- 网页静态文件：${webRelease}`);
console.log(`- Edge 扩展目录：${extensionRelease}`);
if (process.platform === "win32") console.log(`- Edge 扩展压缩包：${extensionZip}`);
console.log("- release-info.json 只记录是否配置 TURN，不记录 TURN 凭据。");

function readArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const current = values[index];
    if (current === "--") continue;
    if (current === "--help" || current === "-h") {
      parsed.help = true;
      continue;
    }
    if (!current.startsWith("--")) throw new Error(`无法识别的参数：${current}`);
    const [rawKey, inlineValue] = current.slice(2).split("=", 2);
    const value = inlineValue ?? values[++index];
    if (!value || value.startsWith("--")) throw new Error(`参数 --${rawKey} 缺少值。`);
    parsed[rawKey] = value;
  }
  return parsed;
}

function normalizeHttpsOrigin(value, label) {
  if (!value) throw new Error(`${label}不能为空。请传入完整的 https:// 地址。`);
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label}不是有效 URL：${value}`);
  }
  if (url.protocol !== "https:") throw new Error(`${label}必须使用 HTTPS：${value}`);
  if (url.username || url.password || url.search || url.hash || (url.pathname && url.pathname !== "/")) {
    throw new Error(`${label}只能包含协议和域名，不能包含账号、路径、查询参数或片段：${value}`);
  }
  return url.origin;
}

function validateIceServers(value) {
  if (!value) return;
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("--ice-servers 必须是有效的 RTCIceServer[] JSON。");
  }
  if (!Array.isArray(parsed) || parsed.some((entry) => !entry || typeof entry !== "object" || !("urls" in entry))) {
    throw new Error("--ice-servers 必须是包含 urls 字段的 RTCIceServer 数组。");
  }
}

function runPnpm(commandArgs, extraEnv) {
  if (process.env.npm_execpath) {
    run(process.execPath, [process.env.npm_execpath, ...commandArgs], extraEnv);
    return;
  }
  run(process.platform === "win32" ? "pnpm.cmd" : "pnpm", commandArgs, extraEnv);
}

function run(command, commandArgs, extraEnv = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: projectRoot,
    env: { ...process.env, ...extraEnv },
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function escapePowerShell(value) {
  return value.replaceAll("'", "''");
}

function printHelp() {
  console.log(`用法：
  pnpm release:prepare -- --web-origin https://watch.example.com --signaling-origin https://signal.example.workers.dev

可选参数：
  --ice-servers '[{"urls":"turn:turn.example.com:3478","username":"...","credential":"..."}]'

也可以使用 TONGKAN_WEB_ORIGIN、TONGKAN_SIGNALING_ORIGIN 和 VITE_RTC_ICE_SERVERS 环境变量。`);
}
