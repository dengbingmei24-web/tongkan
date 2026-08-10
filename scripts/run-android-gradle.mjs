import { spawnSync } from "node:child_process";
import fs from "node:fs";
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
let gradleDirectory = androidDirectory;
let mappedDrive = null;

const hasNonAsciiPath = Array.from(androidDirectory).some((character) => character.charCodeAt(0) > 127);
if (isWindows && hasNonAsciiPath) {
  for (const letter of ["Z", "Y", "X", "W", "V", "U"]) {
    const drive = `${letter}:`;
    if (fs.existsSync(`${drive}\\`)) continue;
    const mapping = spawnSync("subst.exe", [drive, androidDirectory], { stdio: "ignore" });
    if (mapping.status === 0) {
      mappedDrive = drive;
      gradleDirectory = `${drive}\\`;
      break;
    }
  }
  if (!mappedDrive) {
    console.error("Android 工程位于非 ASCII 路径，且没有可用盘符用于 Windows Gradle 兼容映射。");
    process.exit(1);
  }
}

const command = isWindows ? path.join(gradleDirectory, "gradlew.bat") : "sh";
const args = isWindows
  ? ["--no-daemon", "--stacktrace", ...tasks]
  : [path.join(androidDirectory, "gradlew"), "--no-daemon", "--stacktrace", ...tasks];
let result;
try {
  result = spawnSync(command, args, {
    cwd: gradleDirectory,
    stdio: "inherit",
    shell: isWindows,
  });
} finally {
  if (mappedDrive) spawnSync("subst.exe", [mappedDrive, "/D"], { stdio: "ignore" });
}

if (result.error) {
  console.error(`无法启动 Android Gradle Wrapper：${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
