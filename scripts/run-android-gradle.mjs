import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const androidDirectory = path.join(repositoryRoot, "apps", "android");
const tasks = process.argv.slice(2);

if (tasks.length === 0) {
  console.error("请至少提供一个 Android Gradle 任务。");
  process.exit(1);
}

const isWindows = process.platform === "win32";
const command = isWindows ? path.join(androidDirectory, "gradlew.bat") : "sh";
const args = isWindows
  ? ["--no-daemon", "--stacktrace", ...tasks]
  : [path.join(androidDirectory, "gradlew"), "--no-daemon", "--stacktrace", ...tasks];
const result = spawnSync(command, args, {
  cwd: androidDirectory,
  stdio: "inherit",
  shell: isWindows,
});

if (result.error) {
  console.error(`无法启动 Android Gradle Wrapper：${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
