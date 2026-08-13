# Breath Tech Android 实现计划

> 状态：P0 首批 Java View 已通过真机验收；下一阶段进入 Alpha 10.0 账号后端、安全会话与真实邮箱登录。
> 日期：2026-08-11
> 目标：在不破坏 Alpha 9.3.6 播放器基线的前提下，用原生 Java View 落地 Alpha 10 账号与双人空间界面。

## 1. 实施原则

- 不引入 Kotlin、Compose、Material Components 或大型 UI 框架。
- 不直接重写已通过真机验证的播放器；先拆账号与主导航，再迁移观看页职责。
- 页面状态、网络状态和 View 创建逻辑分离，避免继续扩大当前约 80KB 的 `MainActivity.java`。
- 白色主题默认，黑色主题通过 `SharedPreferences` 持久化。
- Android 触控目标至少 48dp；按钮按压反馈必须在 80-150ms 内出现。
- 所有账号页面先支持 Mock 数据，再接入 `AccountClient`，避免 UI 和后端互相阻塞。

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
4. 接入邮箱登录与 SessionStore。
5. 接入好友绑定和首页真实状态。
6. 接入共享片库。
7. 接入日历。
8. 接入历史统计和解绑归档。
9. 最后迁移播放器职责并做双设备回归。

## 8. 第一批代码范围

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
