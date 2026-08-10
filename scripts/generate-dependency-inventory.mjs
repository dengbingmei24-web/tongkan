import { access, readFile, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inventoryPath = path.join(root, "DEPENDENCIES.md");
const manifests = await discoverManifests();
const dependencies = new Map();

for (const manifestPath of manifests) {
  const manifest = await readJson(manifestPath);
  const workspaceName = manifest.name ?? (path.relative(root, path.dirname(manifestPath)) || "root");
  collect(manifest.dependencies, "production", workspaceName, manifestPath);
  collect(manifest.devDependencies, "development", workspaceName, manifestPath);
}

for (const item of dependencies.values()) {
  const installed = await readInstalledPackage(item.name, item.manifestDirs);
  item.version = installed?.version ?? "not installed";
  item.license = normalizeLicense(installed?.license);
}

const output = renderInventory([...dependencies.values()].sort((left, right) => left.name.localeCompare(right.name)));

if (process.argv.includes("--write")) {
  await writeFile(inventoryPath, output, "utf8");
  console.log(`Updated ${path.relative(root, inventoryPath)}`);
} else if (process.argv.includes("--check")) {
  const existing = await readFile(inventoryPath, "utf8").catch(() => "");
  if (existing !== output) {
    console.error("DEPENDENCIES.md is out of date. Run: pnpm deps:report");
    process.exitCode = 1;
  } else {
    console.log("Dependency inventory is current.");
  }
} else {
  process.stdout.write(output);
}

function collect(entries, kind, workspaceName, manifestPath) {
  for (const [name, requested] of Object.entries(entries ?? {})) {
    if (String(requested).startsWith("workspace:")) continue;
    const item = dependencies.get(name) ?? {
      name,
      requested: new Set(),
      kinds: new Set(),
      consumers: new Set(),
      manifestDirs: new Set(),
      version: "not installed",
      license: "UNKNOWN",
    };
    item.requested.add(String(requested));
    item.kinds.add(kind);
    item.consumers.add(workspaceName);
    item.manifestDirs.add(path.dirname(manifestPath));
    dependencies.set(name, item);
  }
}

async function discoverManifests() {
  const result = [path.join(root, "package.json")];
  for (const group of ["apps", "packages"]) {
    const groupRoot = path.join(root, group);
    const entries = await readdir(groupRoot, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const manifestPath = path.join(groupRoot, entry.name, "package.json");
      try {
        await access(manifestPath);
        result.push(manifestPath);
      } catch {
        // Native and other non-JavaScript workspaces do not have a package manifest.
      }
    }
  }
  return result;
}

async function readInstalledPackage(name, manifestDirs) {
  const packageSegments = name.split("/");
  const candidates = [
    ...[...manifestDirs].map((directory) => path.join(directory, "node_modules", ...packageSegments, "package.json")),
    path.join(root, "node_modules", ...packageSegments, "package.json"),
  ];
  for (const candidate of candidates) {
    try {
      return await readJson(candidate);
    } catch {
      // Try the next workspace or root installation path.
    }
  }
  return null;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function normalizeLicense(license) {
  if (typeof license === "string" && license.trim()) return license.trim();
  if (license && typeof license.type === "string") return license.type;
  if (Array.isArray(license)) {
    const values = license.map(normalizeLicense).filter((value) => value !== "UNKNOWN");
    if (values.length > 0) return values.join(" OR ");
  }
  return "UNKNOWN";
}

function renderInventory(items) {
  const rows = items.map((item) => [
    `\`${escapeCell(item.name)}\``,
    escapeCell([...item.requested].sort().join(", ")),
    escapeCell(item.version),
    escapeCell(item.license),
    escapeCell([...item.kinds].sort().join(" + ")),
    escapeCell([...item.consumers].sort().join(", ")),
  ].join(" | "));

  return `# 直接依赖与许可证清单

> 本文件由 \`pnpm deps:report\` 根据各 workspace 的 \`package.json\` 和当前安装结果生成，请勿手工编辑。CI 使用 \`pnpm deps:check\` 防止清单过期。

| 包 | 声明版本 | 已安装版本 | 许可证 | 用途 | 使用方 |
| --- | --- | --- | --- | --- | --- |
${rows.map((row) => `| ${row} |`).join("\n")}

## 范围与解释

- 仅列出直接外部依赖；\`workspace:*\` 内部包和传递依赖不在本表中。
- 许可证来自已安装包的 \`package.json\` 元数据，不构成法律意见。
- 生产部署和发布前仍应保留 \`pnpm-lock.yaml\`，并审查 Dependabot 提出的版本变化。
- 出现 \`UNKNOWN\` 或 \`not installed\` 时不得忽略，应先确认包元数据或重新安装依赖。
`;
}

function escapeCell(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}
