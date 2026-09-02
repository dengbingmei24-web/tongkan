# 更新记录

## 1.0.0-alpha10.4（本地集成，未部署）

### 新增

- Account 增加短期账号房间历史授权、签名内部 ingest、`0008_watch_history.sql` 以及当前 pair/keep archive 的历史、月度摘要和日历实看 marker API。
- Signaling Durable Object 增加双方严格有效播放重叠计时、区间幂等提交、重载恢复、stale/grant 到期边界和失败重试；历史故障不关闭房间或阻断播放、聊天与邀请。
- Android 在现有“我们”页增加月度摘要、最近历史和分页，在“日历”区分计划与实际观看，并为 keep 旧空间提供只读历史入口；没有新增第五个主 tab。
- 新增 `qa/watch-history` 14-case/13-tag 安全默认合同，覆盖 A/B/C、匿名排除、overlap matrix、重试幂等、时区、归档和敏感信息边界。

### 技术与验证

- W1 Account、W2 Signaling、W3 Android/QA 已按 Account → Signaling → Android 顺序无冲突集成；Reviewer 为 `history.bind` 增加独立低频限流，并修复 Android 分页顺序、旧回调、授权重试与归档清理。
- Protocol 类型检查、13 项测试和构建通过；Account 类型检查、13 文件/93 项测试（含真实本地 D1）和 dry-run 通过；Signaling 类型检查、8 文件/67 项测试和 dry-run 通过。
- Android 单元测试与 Lint、History QA PowerShell 解析、14 cases/13 tags ValidateOnly、JSON 解析和差异检查通过。
- 全仓 typecheck、210 项常规测试、信令 integration + Web 七场景自测、Extension bridge、Protocol/Web/Extension/Account/Signaling 非 APK build、依赖清单、127 份 Markdown/46 个本地链接、451 个跟踪路径凭据扫描和差异检查通过；Android APK build 仍未获授权且未运行。

### 发布状态

- migration `0008_watch_history.sql` 仅存在于本地分支；Preview 和生产 D1 仍停留在已部署的 0007 状态。
- 未配置或部署 Preview/生产历史 Service Binding 与 Secrets，未运行 Live QA，未构建或发布 Alpha 10.4 APK，分支未 push。
- Alpha 10.3 生产 Worker 与现有 Alpha 10.3 APK 保持不变；其双设备日历/日常使用矩阵继续延期，不视为已通过。

## 1.0.0-alpha10.3（未发布）

### 新增

- 为每个双人空间增加独立共享日历：月份、日期、今日和 keep 归档读取，以及计划新增、改期、完成、恢复待看和取消。
- 计划从共同片库选择视频并保存媒体快照；片库条目删除后仍可保留标题、封面、BVID、分P和规范链接。
- Android 增加原生七列月格、日期详情与计划编辑器；共同片库可直接“安排日期”，首页增加只展示未完成项的“今天想看”。
- 从计划开始同看复用现有房间、活跃好友房间、播放器和 FCM 可选提醒；keep 旧空间日历保持只读。

### 技术与验证

- 新增 D1 migration `0007_calendar_plans.sql`、`pair_calendar_state` 独立 revision 和 `calendar_plans`；旧 revision 冲突不覆盖新状态，失败不增加 revision。
- W1/W2/W3 已本地集成到 `codex/TK-004-calendar`。全仓 typecheck、149 项测试、集成测试、build、依赖检查、Account 68/68、Calendar 16-case ValidateOnly、Android 55/55、Lint 与 Debug 构建均通过；Preview Calendar Live 16/16、20/20 revision race、归档权限和 D1 级联证据也已通过。生产 D1 0007 和 Worker 健康/鉴权冒烟通过。
- Windows 下 Account 测试文件使用 `vitest run --no-file-parallelism`，避免多个 Wrangler 本地 D1 测试文件同时占用 registry 产生 `EBUSY`；测试内 20 轮并发 revision race 保持不变。
- `git diff --check`、110 个 tracked Markdown 文件链接检查与 413 个 tracked 路径凭据扫描通过；另复核 3 个未跟踪 review 文件，未发现生产凭据。

### 发布状态

- Preview 与生产 D1 均已应用 migration 0007；生产 Account Worker 已部署为 `17a59403-98bb-4652-9ad1-32a5ff5882db`，100% 流量且 `testMode=false`。
- Alpha 10.3 / versionCode 41 生产配置 Debug APK 已生成并替换为当前 Breath Tech 源码候选，SHA-256 `356301A7AD1A350F9E335DC64912F5835A2E72A59E6AF64FBA9EA73BC8704647`。用户已确认视觉真机验收；分支未 push，APK 未公开发布，双设备日历/日常使用验收和发布日期仍待确认。

## 1.0.0-alpha10.2.4 - 2026-08-19

### 修复与体验

- 修复部分 Android 主题下解绑弹窗只显示“取消”、保留/删除选项不可见的问题，改为三个明确按钮。
- 登录且已绑定好友时，创建房间会自动发布为 10 分钟短期活跃房间；另一方在 App 首页可直接看到并进入。
- FCM 改为可选提醒：通知失败不再强制分享链接；只有活跃房间发布失败才显示复制/系统分享兜底。
- 新增 `0006_active_pair_rooms.sql` 与 pair-only `GET/POST/DELETE /api/pair/active-room`，访客邀请 URL 加密保存，解绑同步删除。
- Android 升级为 versionCode 40 / `1.0.0-alpha10.2.4`。
- 生产 D1 已应用 migration `0006`，生产 Account Worker 已部署为 `519be06a-5d10-4f8e-ba69-a00e7216493e`；正式健康检查为 200/`testMode=false`，未登录片库与活跃房间接口均为 401。
- 生产配置 APK 已通过 46/46 JVM 测试、Lint 0 错误/25 警告和版本/配置校验，SHA-256 为 `64D6530D50E127528CA0BD57E9F2F04C37E20EAB25E9F174BDB11C0581A09BA6`。

本项目使用递增 Android `versionCode` 和语义化 `versionName`。安装包请从 [GitHub Releases](https://github.com/dengbingmei24-web/tongkan/releases) 下载。
## 1.0.0-alpha10.2.3 - 2026-08-19

### 修复

- 登录账号可临时切换到匿名模式并一键返回；退出和切换账号会完整重置验证码表单，支持重新登录。
- 解除好友改为单层 keep/delete 选择，提交后重新读取服务端权威状态。
- “邀请好友一起看”明确显示邀请对象；从共同片库开始观看时优先发送好友通知，失败时显示复制链接和系统分享兜底。
- 共同片库视频支持 1–160 字符重命名，刷新元数据不会覆盖自定义名称。
- B站封面固定请求 JPEG 缩略图，避免旧 Android 因图片格式协商导致空白封面。

### 技术

- Account API 的条目 PATCH 新增 `title`，复用现有数据库字段，不需要 D1 migration。
- Android 升级为 versionCode 39；Account 53/53、Android 44/44、全仓 134 项测试、typecheck、build、真实信令集成和 Lint 0 错误/23 警告通过。Preview Worker 为 `093b89a5-2bcd-42fe-b7a6-9e8c04c0bd8c`，生产 Worker 为 `62bc7034-2599-4519-bf3b-dd119e68dd67`。生产配置 APK SHA-256 为 `C081BC427C8E1650374E48C711C937D2F620883EEA9F0E4E492A3A8BE89EE681`。
## 1.0.0-alpha10.2.2 - 2026-08-18

### 修复

- 修复 Account Worker 在 Cloudflare Runtime 中错误调用未绑定全局 `fetch`、导致所有 B23 短链返回 `B23_RESOLUTION_FAILED` 的根因。
- B23 解析在首个安全跳转已暴露 BV/av 时立即完成，并兼容受大小限制的 200 HTML 落地页；继续限制 HTTPS、可信 B站域名和跳转次数。
- Android 将分行的 B站分享标题与下一行链接视为同一条输入，并向服务端提交规范化后的纯 B23/BV/av 地址。

### 验证与状态

- 截图短链 `https://b23.tv/XM569Iw` 已在本地 Workers Runtime 中真实添加为 `BV1SBbS6hEHa`，元数据状态为 ready。
- Account 51/51、Android 42/42、Lint 0 错误/23 警告、全仓 132 项测试、typecheck 和 build 通过；Preview Worker 已更新。
- 生产配置 Debug APK 为 versionCode 38，SHA-256 `F48C5CC4C06A1A6BC1B17EC3D8AC90E6466E85B2644E953DD6B7C00036499FB2`。生产 Account Worker 已部署版本 `1198e7ba-ff25-4aca-8369-105e2e1efa19` 并通过健康/鉴权边界冒烟；截图短链仍待真机最终复验。

## 1.0.0-alpha10.2.1 - 2026-08-18

### 改进

- 片库添加改为底部面板，粘贴后逐条显示直链识别、B23 待解析、无效输入和 20 条上限。
- 添加完成后逐条显示已添加、重复或失败原因；B23 无法展开时明确提示短链失效或视频不可用。
- 共同片库默认按分类展示带封面的媒体分区，并保留搜索、筛选、管理和显式排序。
- 竖屏房间增加底部片库抽屉，横屏/全屏增加右侧片库抽屉；选择视频时画面保持可见。
- 匿名和未绑定用户继续通过“换视频”进入手动链接流程；片库切换仍在 0 秒暂停等待手动播放。

### 技术

- 新增受限 HTTPS 封面加载、大小限制、下采样与内存缓存，不引入第三方依赖。
- Android 版本升级为 versionCode 37；Account API、D1、生产 Worker 和房间协议不变。
- Android 41/41 单元测试、Lint 0 错误/23 警告、生产配置 Debug APK 构建与版本校验通过；全仓 129 项测试和 typecheck 通过。
## 1.0.0-alpha10.2 - 2026-08-18

### 新增

- QQ 邮箱验证码账号、持久登录、稳定用户 ID、昵称和唯一好友双人空间。
- 双人共同片库：批量添加 B站链接、分类、搜索、未观看/已看完筛选、排序和元数据补全。
- 从片库立即同看以及房间内换视频；新视频准备完成后停在 0 秒等待手动播放。
- 单方面解绑与双方独立 keep/delete 归档选择，保留的旧片库只读。
- FCM 好友邀请、通知深链和系统分享兜底。

### 生产后端

- 生产 D1 应用 `0004_pair_archives.sql` 与 `0005_shared_library.sql`。
- 生产 Account Worker 部署共享片库与归档 API，正式环境保持 `AUTH_TEST_MODE=false`。
- Android 使用生产 Pages `/account-api`，不包含 Preview 测试令牌。

### 验证与限制

- 全仓类型检查、118 项常规测试、11 项本地 D1 集成测试、WebSocket 集成、构建、依赖、链接和凭据检查通过。
- Android 39/39 单元测试、Lint 0 错误/19 警告和生产配置 APK 构建通过。
- 当前 APK 使用 Debug 证书，仅供个人日常安装；双设备片库、FCM 和完整 Beta 物理验收因暂时没有第二位测试者延期。

## 1.0.0-alpha.9.2 - 2026-08-10

### 新增

- 全新的房间入口页，先创建房间或粘贴邀请链接，再进入视频页面。
- 浅色与中性黑色深色主题，默认浅色并在本地保存选择。
- 每日按本地日期轮换一条经典电影台词。
- 竖屏居中 16:9 播放器和顶部房间状态。
- 手动横屏与沉浸全屏覆盖控制层。
- B站弹幕开关和六档播放倍速。

### 修复

- 修复页面被刘海、灵动岛或状态栏遮挡。
- 阻止点击 B站播放器后跳转到外部视频网页。
- 修复横屏无法进入、原生控制不可见和播放器纵向铺满问题。
- 同步竖屏/横屏播放图标、时间与进度条。
- 缓冲、暂停、拖动和加载时保持沉浸控制可见；播放后 3 秒自动隐藏。

### 验证

- 15 项 Android 单元测试通过。
- Android Lint 0 错误。
- Debug APK 构建通过并完成真机测试。

## 历史 Alpha

- `1.0.0-alpha.9.1`：安全区、16:9 播放器、导航拦截和手动横屏修复。
- `1.0.0-alpha.9`：首个房间入口与原生控制版本。
- `1.0.0-alpha.7`：切换到 OkHttp WebSocket 的稳定回滚基线。
