# 同看 (Tongkan) — Agent 开发指令

## 项目概述

同看是一个双人同步观看 B站视频的自用工具。当前 Alpha 9 使用匿名临时房间；Alpha 10 将增加邮箱验证码账号、唯一好友和长期双人空间。
架构：Cloudflare Durable Objects 信令 + Web 房间页 + Chrome 扩展 + Android App。

## 代码仓库结构

```
apps/
  signaling/    Cloudflare Worker (Durable Objects) — 房间信令服务
  web/          React (Vite) — 房间网页 UI
  extension/    Chrome/Edge Manifest V3 扩展 — B站播放器注入
  android/      原生 Java + WebView — Android 客户端
packages/
  protocol/     共享类型定义、协议常量、B站链接解析
scripts/        构建/部署/测试脚本
qa/             测试契约 JSON、QA 清单
release/        构建产物目录
```

## 上下文管理协议（最重要）

项目上下文由四个根目录文件组成：

| 文件 | 作用 |
|---|---|
| `AGENTS.md` | AI 执行规则、技能路由、安全和构建约束 |
| `PROJECT_CONTEXT.md` | 稳定产品背景、仓库目录地图、架构和文档索引 |
| `CONTEXT.md` | 当前版本、开发状态、问题、任务和跨对话交接 |
| `DECISIONS.md` | 已确认的长期产品、设计和技术决策 |

**每次新对话开头必须按顺序执行**：

1. 读取 `CONTEXT.md`，确认当前版本和最近状态。
2. 读取 `PROJECT_CONTEXT.md`，定位任务对应的目录和真源文档。
3. 如果任务涉及产品、架构、协议、UI 或版本范围，搜索并读取 `DECISIONS.md` 中的相关决策。
4. 根据 `PROJECT_CONTEXT.md` 的“任务到目录和文档映射”读取对应 PRD、设计、部署或 QA 文档。
5. 修改前检查 `git status --short`，不要覆盖已有未提交改动。

**每次对话结束前必须执行**：

- 无论是否修改代码，都更新 `CONTEXT.md` 的 `last_updated` 和本轮状态。
- 至少检查并按需更新：`current_version`、`status`、Completed、In Progress、Known Issues、Next Steps、Conversation Log。
- 如果用户确认了跨对话仍然有效的产品、设计、协议或架构选择，追加到 `DECISIONS.md`。
- 如果仓库结构、核心产品边界或文档真源发生长期变化，更新 `PROJECT_CONTEXT.md`。
- 产品范围变化同步对应 PRD；设计变化同步 `design/alpha9-ui/SELECTED_DESIGN.md`。

**对话过长或即将压缩上下文时**：优先更新 `CONTEXT.md`，确保目标、已完成工作、阻塞和下一步完整可恢复。

不要把临时开发流水全部写进 `PROJECT_CONTEXT.md`；动态进度只写 `CONTEXT.md`。

## 技能路由表

### 同看项目开发（直接处理，不引入技能）

这些是日常开发场景，直接读写代码即可，**不需要**任何技能：

| 场景 | 做法 |
|---|---|
| Android 构建/调试 | 直接改 RoomClient.java、MainActivity.java 等，Gradle 构建 |
| Cloudflare 信令修改 | 直接改 worker.ts、room-session.ts，wrangler 部署 |
| Web 前端修 bug | 直接改 App.tsx、room-client.ts 等 |
| APK 构建 | 走 `C:\tmp\android-build\project` 避开中文路径 |

### 同看项目开发（可用技能）

| 场景 | 技能 | 何时用 |
|---|---|---|
| Web 页面重设计或新增页面 | `hallmark` | 从零做新页面或整体推翻旧 UI，不是修小 bug |
| 产品宣传片（电影感） | `video-shotcraft` | Remotion + 真页面截图 + 运镜，适合同看的 React 页面 |
| 产品宣传片（暗黑 SaaS） | `rn-dark-saas-video` | 黑色星空 + 大字体动效，同看暗色 UI 风格匹配 |
| 动画视频自由创作 | `rn-motion-director` | 给主题/脚本自由生成动画视频，不限于固定模板 |
| 宣传片旁白配音 | `tts-skill` | 用 IndexTTS2 生成中文旁白 |
| 通用视频编辑 | `video-use` | 剪辑、调色、字幕烧录 |
| 架构决策追溯 | `dbs-decision` | 把同看的架构决策做成可追溯的知识工程 |
| 模糊需求澄清 | `dbs-good-question` | 把'用户说不清楚要什么'改写成 Agent 可执行的问题说明书 |

### 用户可能顺带做的其他事（不属同看开发）

这些是用户在这个对话里可能穿插的非开发任务，按需触发：

| 任务类型 | 可用技能 |
|---|---|
| 视频下载 | `ra-video-download` |
| 视频制作/编排 | `ra-video-production-director` |
| 口播视频剪辑 | `ra-local-talking-head-cut`（仅口播粗剪，通用编辑用 `video-use`） |
| 字幕生成与烧录 | `ra-audio-to-subtitles`、`skill-captions` |
| 社交媒体封面 | `skill-cover`、`editorial-dot-cover` |
| 翻页网页 PPT | `guizang-ppt-skill` |
| PPT 生成/编辑 | `open-kimi-ppt` |
| 公众号排版 | `gzh-design`、`wechat-skill` |
| 小红书图文 | `xhs-article-to-images` |
| 文稿诊断 | `dbs-content`、`dbs-hook`、`dbs-resonate` |
| 商业分析 | `dbs-diagnosis`、`dbs-benchmark` |
| 去 AI 味写作 | `ra-人话` |

### 与同看无关（已核查，不要使用）

以下 40+ 个技能与此项目完全无关，任何场景都不触发：
dbs-系列（action/ai-check/chatroom/chatroom-austrian/content-system/deconstruct/goal/
learning/report/slowisfast/spread/xhs-title）、ra-系列（hook/洗稿/选题/复盘/实操策划/
逐字稿提取skill/公众号提取/video-wash-pipeline）、AI剪口播、heygen-digital-avatar、
hatch-pet、brand-to-design-md、editorial-collage-motion、gc-minimal-zine-poster-v0-1、
ian-xiaohei-illustrations、skill-cover、editorial-dot-cover、rn-cover-skill、
rn-bw-text-opener、rn-replica-qc、guizang-ppt-skill、xhs-article-to-images、
wechat-skill、gzh-design、open-kimi-ppt、dbs-save、dbs-restore（已被 CONTEXT.md 替代）。

**原则**：
- 开发任务（代码、构建、调试）不引入技能，直接处理
- 只有重设计/重写时才用 `hallmark`
- 不确定是否用技能时，默认不用
- 用户明确说"做个视频/PPT/封面"时才触发对应技能

## 本地开发命令

```powershell
pnpm install
pnpm dev:signaling     # 启动本地信令服务 (Wrangler)
pnpm dev:web           # 启动 Web 房间页 (Vite, localhost:5173)

# 测试
pnpm test              # 全部测试
pnpm test:integration   # 集成测试
pnpm typecheck          # 类型检查

# Android
pnpm android:check     # 测试 + Lint + Debug APK
pnpm android:build     # 仅 Debug APK

# 构建产物
pnpm build
pnpm release:prepare -- --web-origin https://你的地址
```

## Android 环境速查

Android 项目在 `apps/android/`。构建需要 JDK 17 + Android SDK 35。
如果不能直接从中文路径运行（Gradle 不支持），复制到 `C:\tmp\android-build\project` 再构建。

```powershell
# 设置环境
$env:JAVA_HOME = "C:\tmp\android-build\jdk17\jdk-17.0.14+7"
$env:ANDROID_HOME = "C:\tmp\android-build\android-sdk"

# 复制项目
Copy-Item -Recurse -Force "C:\...\同步观看视频\apps\android" "C:\tmp\android-build\project"
"sdk.dir=C:\\tmp\\android-build\\android-sdk" | Set-Content "C:\tmp\android-build\project\local.properties"

# 构建
cd C:\tmp\android-build\project
.\gradlew.bat assembleDebug --no-daemon

# 构建后同步 APK 到 release/
Copy-Item "C:\tmp\android-build\project\app\build\outputs\apk\debug\*.apk" `
          "C:\...\同步观看视频\release\tongkan-android-1.0-alphaN.apk"
```

### APK 真机测试交付

- 当构建结果需要用户安装或真机测试时，完成构建后自动打开 `release/` 文件夹，并在资源管理器中选中本次应测试的 APK；不要只提供文字路径。
- 如果 APK 尚未生成或构建失败，不打开旧 APK，并明确说明阻塞原因。

## 编码规范

- **Java (Android)**：跟现有风格，不引入 Kotlin / Jetpack / Compose。minSdk 26。
  连接逻辑在 RoomClient.java，UI 在 MainActivity.java。错误信息用中文。
- **TypeScript (Web/Signaling)**：严格模式，noUncheckedIndexedAccess。
  协议类型在 packages/protocol/src/types.ts。
- **不引入新依赖**：除非必要。Android 当前使用 OkHttp 4.12.0，不再随意更换网络栈。
- **不修无关 bug**：只修任务范围内的。
- **不做过度设计**：这是个人自用工具，保持简单。

## 关键文件速查

| 目的 | 文件 |
|---|---|
| Android WebSocket 连接 | `apps/android/.../RoomClient.java` |
| Android UI | `apps/android/.../MainActivity.java` |
| 协议消息格式 | `apps/android/.../RoomProtocol.java` |
| 信令 Worker | `apps/signaling/src/worker.ts` |
| 房间会话逻辑 | `apps/signaling/src/room-session.ts` |
| 共享类型 | `packages/protocol/src/types.ts` |
| 线上部署配置 | `apps/signaling/wrangler.toml` |
| QA 清单 | `QA_CHECKLIST.md` |
| PRD | `PRD.md` |
| 部署文档 | `DEPLOYMENT.md` |
| 上下文快照 | `CONTEXT.md` ← 每次先读这个 |

## 线上环境

- Cloudflare Pages：`tongkan-personal.pages.dev`
- 信令 Worker：通过 Pages Service Binding 同域访问
- `workers.dev` 域名可能不可达，Android App 不使用
- 房间 API：`POST https://tongkan-personal.pages.dev/api/rooms`
- WebSocket：`wss://tongkan-personal.pages.dev/rooms/{roomId}`
- CORS 白名单：`ALLOWED_WEB_ORIGINS` 环境变量控制


## ⚠️ 防数据丢失规则（2026-08-06 教训）

1. **修改文件前先 `git stash`**：保留当前工作区快照
2. **验证用 tmp build 目录**：`git checkout` 之后查看的是 git 版本，不是工作区版本
3. **关键增量改动后立即 commit**：不要积攒未提交改动，防止 `git checkout` 意外回退
4. **编码问题用 `C:\tmp\android-patch\` 中转**：Node.js 和 PowerShell 都可能在中文字符路径上失败
5. **`git checkout <file>` 会丢弃未提交改动**：执行前确认要恢复的文件没有需要保留的增量

## 对话生命周期

```
新对话开始
  → 读取 CONTEXT.md（获取上次状态）
  → 读取 AGENTS.md（自动）
  → 用户说需求
  → 开发、调试、构建
  → 完成时更新 CONTEXT.md
  → 标记分支/构建但不要 commit（除非用户明确要求）
```

每个对话保持聚焦。如果一个对话同时涉及多个不相关的领域（如既改 Android 又做视频），
建议用户分两个对话处理。
