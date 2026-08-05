import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requireFromSignaling = createRequire(path.join(projectRoot, "apps", "signaling", "package.json"));
const wranglerPackage = requireFromSignaling.resolve("wrangler/package.json");
const wranglerCli = path.join(path.dirname(wranglerPackage), "bin", "wrangler.js");
const args = readArgs(process.argv.slice(2));

if (args.help) {
  printHelp();
  process.exit(0);
}

const webOrigin = normalizeHttpsOrigin(args["web-origin"], "网页地址");
const signalingOrigin = normalizeHttpsOrigin(args["signaling-origin"] ?? webOrigin, "信令地址");
const pagesProject = normalizeProjectName(args["pages-project"]);
const iceServers = args["ice-servers"] ?? "";

console.log("1/3 部署 Cloudflare Worker 信令服务…");
runWrangler([
  "deploy",
  "--var",
  `ALLOWED_WEB_ORIGINS:${webOrigin}`,
], path.join(projectRoot, "apps", "signaling"));

console.log("\n2/3 构建网页和生产版 Edge 扩展…");
const prepareArgs = [
  "scripts/prepare-production.mjs",
  "--web-origin",
  webOrigin,
  "--signaling-origin",
  signalingOrigin,
];
if (iceServers) prepareArgs.push("--ice-servers", iceServers);
run(process.execPath, prepareArgs);

console.log("\n3/3 部署 Cloudflare Pages 网页…");
runWrangler([
  "pages",
  "deploy",
  "dist",
  "--project-name",
  pagesProject,
  "--branch",
  "main",
], path.join(projectRoot, "apps", "web"));

console.log("\n公网部署完成。请用手机打开网页地址验证创建房间和加入房间。B站双向控制目前仍需要桌面扩展。 ");

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
  if (!value) throw new Error(`${label}不能为空。`);
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label}不是有效 URL：${value}`);
  }
  if (url.protocol !== "https:") throw new Error(`${label}必须使用 HTTPS：${value}`);
  if (url.username || url.password || url.search || url.hash || (url.pathname && url.pathname !== "/")) {
    throw new Error(`${label}只能包含协议和域名：${value}`);
  }
  return url.origin;
}

function normalizeProjectName(value) {
  if (!value || !/^[a-z0-9][a-z0-9-]{0,57}[a-z0-9]$/.test(value)) {
    throw new Error("--pages-project 必须是 2–59 位小写字母、数字或连字符组成的 Cloudflare Pages 项目名。");
  }
  return value;
}

function runWrangler(commandArgs, cwd) {
  run(process.execPath, [wranglerCli, ...commandArgs], cwd);
}

function run(command, commandArgs, cwd = projectRoot) {
  const result = spawnSync(command, commandArgs, {
    cwd,
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function printHelp() {
  console.log(`首次使用前先运行：
  pnpm --filter @tongkan/signaling exec wrangler login

部署命令：
  pnpm deploy:cloudflare -- --web-origin https://你的项目.pages.dev --pages-project 你的项目

默认通过 Pages 同域代理连接信令 Worker，避免客户端直接访问 workers.dev。
可选：追加 --ice-servers '<RTCIceServer[] JSON>' 配置 TURN。`);
}
