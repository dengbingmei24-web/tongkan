# Breath Tech Android 实现计划

> 状态：P0.1-P0.3、生产 QQ 邮箱登录和唯一好友绑定已通过真机验收；Alpha 10.1 P0.6 已接入一键邀请、设备 token 与 FCM，双设备通知送达暂缓验收。
> 日期：2026-08-11
> 目标：在不破坏 Alpha 9.3.6 播放器基线的前提下，用原生 Java View 落地 Alpha 10 账号与双人空间界面。

## 1. 实施原则

- 不引入 Kotlin、Compose、Material Components 或大型 UI 框架。
- 不直接重写已通过真机验证的播放器；先拆账号与主导航，再迁移观看页职责。
- 页面状态、网络状态和 View 创建逻辑分离，避免继续扩大当前约 80KB 的 `MainActivity.java`。
- 白色主题默认，黑色主题通过 `SharedPreferences` 持久化。
- Android 触控目标至少 48dp；按钮按压反馈必须在 80-150ms 内出现。
- 账号页面通过可配置 `AccountClient` 接入；服务地址未配置或不可用时必须保留匿名房间降级。

## 2. 建议目录

`apps/android/app/src/main/java/com/tongkan/mobile/`

```text
ui/
  BreathTheme.java
  BreathDrawables.java
  BreathComponents.java
  MainNavigationView.java
  AuthScreen.java
  HomeScreen.java
  LibraryScreen.java
  CalendarScreen.java
  PairScreen.java
account/
  AccountClient.java
  SessionStore.java
  AccountModels.java
watch/
  WatchController.java
```

首轮不强制创建多个 Activity；可以先用独立 Screen 类返回 View，在后端与导航稳定后再决定是否拆分 `AuthActivity` 和 `WatchActivity`。

## 3. P0：设计系统底座

### 3.1 BreathTheme

- 集中定义白色/黑色主题颜色、文字层级、边界、冷光蓝和危险色。
- 提供 `isDark()`、`toggle()`、`applySystemBars()` 和主题监听。
- 迁移现有 `darkMode` 布尔值，兼容原 SharedPreferences 数据。

### 3.2 BreathDrawables

- 统一创建背景、面板、输入框、主按钮、描边按钮、危险按钮和选中态 Drawable。
- 使用 `StateListDrawable`/Ripple 表达按下态；不使用旧式高光渐变和厚重阴影。
- 圆角 Token：按钮 14dp、输入框 14dp、面板 19dp、图标按钮 13dp。

### 3.3 BreathComponents

- 标题区、状态编码、44/48dp 图标按钮、主按钮、输入框、列表行、Toast、底部 Drawer。
- 提供统一加载按钮 API：`setLoading(button, true, "正在处理")`。
- 所有图标使用 VectorDrawable；不使用 Emoji 或文本符号替代图标。

### 3.4 Insets 与系统栏

- 通过 Window Insets 处理打孔屏、状态栏、导航栏和手势区域。
- 主页面顶部不能再被系统栏遮挡；底部导航必须包含安全区。

## 4. P0：页面骨架

### 4.1 AuthScreen

- 邮箱输入、获取验证码、验证码输入、登录结果和匿名房间入口。
- 支持默认、输入中、加载、发送成功、验证码错误、网络错误和账号服务不可用状态。
- 匿名入口复用现有 Alpha 9 房间创建/加入流程。

### 4.2 MainNavigationView

- 首页、片库、日历、我们四个固定入口。
- 选中态只使用文字/图标反差和底部冷光线，不使用大胶囊。
- 页面切换不销毁当前输入和滚动状态。

### 4.3 HomeScreen

- 双人在线轨道、连接状态、创建房间、加入房间、今日计划和三项摘要。
- 创建房间保持现有“创建后自动分享”行为。
- 未绑定好友、好友离线、账号服务失败时提供明确替代状态。

## 5. P1：双人空间页面

### 5.1 LibraryScreen

- 搜索、全部/想看/已计划/已看完筛选、媒体列表和固定添加按钮。
- 首版支持 Loading、Empty、Error 和有数据状态。
- 添加、排序和删除使用 Drawer/确认层，不藏进右上角更多菜单。

### 5.2 CalendarScreen

- 月历、计划点、选中日期、当天时间线和创建计划 Drawer。
- 日期触控区域 48dp；日期必填，时间和备注可选。
- 列表顺序遵循账号 PRD：有时间项目在前，无时间项目在后。

### 5.3 PairScreen

- 双头像轨道、绑定天数、累计同看、完成数、片库数量。
- 共同历史、旧空间归档、账号设置和解除绑定直接展示。
- 解绑必须有二次确认，并进入双方独立归档选择流程。

## 6. P1：播放器整合

- 现有播放器先保持独立，不在第一轮重画 WebView/全屏逻辑。
- 从首页、片库和日历进入观看时传入统一媒体/房间参数。
- 后续将 `MainActivity` 中观看职责迁入 `WatchController` 或 `WatchActivity`。
- 横屏继续使用透明控制层；只迁移 Breath Tech 图标、按钮反馈和状态文案。

## 7. 开发顺序

1. 创建 Theme、Drawable 和 Components 底座。
2. 将现有 Alpha 9 房间入口套入 Breath Tech Auth/Home 外壳。
3. 加入四入口导航和 Mock 页面。
4. [已完成并真机验收] 接入邮箱登录、`AccountClient`、Keystore `SessionStore` 与快速缓存恢复。
5. [已完成并真机验收] 接入唯一好友绑定、首页真实状态和好友一键同看邀请。
6. 接入共享片库。
7. 接入日历。
8. 接入历史统计和解绑归档。
9. 最后迁移播放器职责并做双设备回归。

## 8. 第一批代码范围（已完成）

第一批只修改 Android UI 架构，不依赖账号后端完成：

- 新增 `ui/BreathTheme.java`。
- 新增 `ui/BreathDrawables.java`。
- 新增 `ui/BreathComponents.java`。
- 新增 `ui/AuthScreen.java`、`ui/HomeScreen.java` 和 `ui/MainNavigationView.java`。
- 在 `MainActivity.java` 中接入新页面外壳，同时保留现有房间与播放器方法。
- 不删除旧观看逻辑，不改变 WebSocket 协议，不构建账号 API 假实现。

## 9. 第一批验收

- 冷启动进入 Breath Tech 登录/匿名入口，不再显示旧页面视觉。
- 白色默认、黑色切换和重启持久化正常。
- 顶部与底部均不被系统栏遮挡。
- 创建/加入房间仍可进入当前 Alpha 9.3.6 观看流程。
- 主按钮按下、加载、禁用、成功和错误反馈可见。
- 360×640 至 1440×3200 Android 画布无关键控件裁切。
- TalkBack 能读出主要按钮、输入框、导航和主题切换含义。
- `assembleDebug`、现有单元测试和 Android Lint 通过。

## 10. P0.2 账号接线结果

- 新增 `account/AccountClient.java`、`AccountModels.java` 和 `SessionStore.java`。
- 实现发送验证码、验证码登录、`/api/me` 会话校验、临近过期刷新和退出。
- Session Token 通过 Android Keystore AES-GCM 加密保存；无法安全保存时拒绝保留登录状态。
- AuthScreen 支持邮箱、验证码、重新获取、更换邮箱、加载状态和错误文案。
- HomeScreen 显示匿名/已登录状态；“我们”页提供当前账号摘要和退出入口。
- 构建参数 `-PtongkanAccountApiOrigin=https://...` 注入账号 Worker Origin；默认空值不会误连未部署服务。
- 深链、匿名房间、WebView、WebSocket、播放器和横屏逻辑未改变。
- 静态验收：17 个 Android JVM 测试、Lint 和 Debug APK 构建通过。
- 剩余验收：QQ SMTP 真实投递、生产 Account Worker 部署、两台设备真机登录/恢复/退出和匿名回归。

## 11. P0.3 预览账号联调

- 预览账号 Worker、独立 D1 和 Pages 同域 `/account-api` Service Binding 已部署。
- 预览 API 使用临时访问令牌，验证码作为 `debugCode` 返回并在 App 内显示，不发送邮件。
- 服务端发送、验证、`/api/me`、刷新、旧 Token 失效和退出闭环已在线验证。
- Android 版本升级为 `1.0.0-alpha10.0-p0.3` / versionCode 21。
- 临时令牌只存在 Cloudflare Secret、仓库外构建目录和测试 APK，不写入仓库。
- 本阶段目标仅是验证 Android 登录/Keystore/会话 UX；真实 SMTP 完成后必须移除测试令牌。

## 12. Alpha 10.1 P0.1 唯一好友闭环

- 新增 `0002_pairing.sql`：一次性邀请、双人关系和 `user_id` 主键唯一的活动关系成员表。
- 邀请码有效期 24 小时，服务端只保存 HMAC；接受时原子检查双方未绑定并创建唯一 `pairId`。
- 新增 `POST /api/pair/invites`、`POST /api/pair/invites/{code}/accept` 和 `GET /api/pair`。
- Android“我们”页支持生成、复制、输入并接受邀请码、刷新状态，以及绑定后的双人资料和开始同看入口。
- 预览 D1 迁移和 Worker 已部署；双账号在线生成、接受和双方查询闭环通过。
- 静态验收：18 个 Android JVM 测试、Lint 0 错误、Account 12 项测试、全仓 93 项测试和生产构建通过。
- 下一验收：双账号真机操作、会话重启恢复、双方状态刷新和匿名房间/播放器回归。

## 13. Alpha 10.1 P0.2-P0.6 生产接线结果

- QQ SMTP 465 生产验证码投递和 Android 登录已通过真机验收；账号服务通过 Pages `/account-api` 同域入口访问。
- 关闭并重启 App 时先显示本地缓存账号主页，再在后台校验或刷新会话；仅明确鉴权失败才清除登录状态。
- “我们”页已连接唯一好友状态、邀请码创建/复制/接受/刷新和绑定后的一键同看邀请。
- 一键邀请先创建房间并尝试向好友活动设备发送 FCM；无 token、权限拒绝或推送失败时自动打开系统分享兜底。
- 生产 FCM Secret、Google OAuth 和 FCM HTTP v1 鉴权冒烟测试已通过；真实双设备通知送达、后台接收和点击进房暂缓。
- 当前审查门槛：账号/好友 UI 必须可达、缓存登录不能阻塞首屏、测试访问令牌必须显式选择、推送错误不得记录服务端响应正文。
