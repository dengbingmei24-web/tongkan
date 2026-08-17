# 同看 Android 工程

## 固定构建环境

- JDK 17
- Gradle 8.9（通过 Gradle Wrapper 自动使用）
- Android Gradle Plugin 8.7.3
- Android SDK Platform 35
- Android Build Tools 35.0.0

不要使用电脑中单独安装的 Gradle 命令；统一使用本目录的 `gradlew` / `gradlew.bat`。

## 本地检查

在仓库根目录运行：

```text
pnpm android:test
pnpm android:lint
pnpm android:build
pnpm android:check
```

`android:check` 会依次执行：

1. `testDebugUnitTest`：运行 Android JVM 单元测试和协议契约测试。
2. `lintDebug`：检查权限、API 兼容性和常见 Android 问题。
3. `assembleDebug`：生成可安装的 Debug APK。

APK 输出位置：

```text
apps/android/app/build/outputs/apk/debug/app-debug.apk
```

已发布的安装包统一保存在 GitHub Releases，避免 APK 二进制长期占用 Git 仓库：

- 当前版本：[`v1.0.0-alpha.9.2`](https://github.com/dengbingmei24-web/tongkan/releases/tag/v1.0.0-alpha.9.2)
- 全部版本：<https://github.com/dengbingmei24-web/tongkan/releases>


## Alpha 10 账号服务配置

Android 账号登录通过构建参数注入公开的 Account Worker HTTPS 地址，不把环境地址或任何 Secret 写死在源码中：

```powershell
.\gradlew.bat assembleDebug `
  -PtongkanAccountApiBaseUrl=https://你的域名/account-api `
  -PtongkanAccountTestAccessToken=仅限隔离预览环境的临时令牌 `
  -PtongkanAllowAccountTestAccessToken=true
```

- 未传入 `tongkanAccountApiBaseUrl` 时，账号页明确显示服务尚未配置，匿名创建/加入房间保持可用。
- `tongkanAccountTestAccessToken` 只用于隔离预览 D1 的短期联调 APK；非空值必须同时显式传入 `-PtongkanAllowAccountTestAccessToken=true`，否则 Gradle 直接拒绝构建。
- 正式 QQ 邮件版本必须移除测试令牌和允许开关；不要把它们写入 `gradle.properties`、APK 发布脚本或 GitHub Actions。
- 地址必须是 HTTPS Base URL，可包含固定的 `/account-api` 前缀；不能包含查询参数、账号密码、路径穿越或重复斜杠。
- SMTP 授权码、HMAC Secret 和 Session Secret 只配置在 Cloudflare Worker，绝不能打进 APK。
- Session Token 使用 Android Keystore 生成的 AES-GCM 密钥加密后保存；昵称和脱敏邮箱仅作为本地界面缓存。

## 安装到两部手机

1. 从 GitHub Release 下载 `tongkan-android-1.0.0-alpha.9.2.apk`，分别发送到两部 Android 手机。
2. 在手机系统设置中，仅为当前文件管理器或聊天 App 开启“允许安装未知应用”。
3. 点击 APK 完成安装；系统提示来源未知属于 Debug 包的正常现象。
4. 两部手机都打开“同看”，第一部创建房间并分享邀请链接，第二部从链接加入。
5. 任意一部手机粘贴 B站 BV/AV 链接并载入，然后分别测试播放、暂停和拖动。

最低支持 Android 8.0（API 26）。当前 APK 使用 Android Debug 证书签名，仅用于个人测试，不应作为应用商店正式发行包。

## Android 1.0 双机验收

- 两部手机显示同一个 B站视频和真实总时长。
- 任意一方播放、暂停或拖动后，另一方执行相同操作。
- 连续交替控制 20 次，不出现播放/暂停循环抖动。
- 一部手机切换 Wi-Fi/移动网络后能够自动重连并恢复最新进度。
- 视频播放到结尾时，两部手机的进度条都到达真实末尾。

首次构建需要联网下载 Gradle、Android 插件和 Maven 依赖。Android Studio 用户可以直接打开 `apps/android`，等待 Gradle Sync 完成后运行相同任务。

## 自动 CI

`.github/workflows/android.yml` 会在 Android、共享协议夹具或协议校验代码发生变化时自动运行全部检查，并上传 APK、JUnit 报告和 Lint 报告。

推送 `v*` 版本标签时，`.github/workflows/android-release.yml` 会再次执行完整检查，并自动创建带 APK 和 SHA-256 校验文件的 GitHub 预发布版。版本升级与标签规则见仓库中的 `docs/operations/RELEASING.md`。

## Alpha 10.1 设备推送基础

账号服务已提供设备令牌注册/注销和好友一起看邀请接口。Android 端的 `PushTokenProvider` 是厂商推送 SDK 的接入边界，当前内置 `NoopPushTokenProvider` 不生成令牌，因此不会在未配置 FCM/华为 Push 时误报已开启通知。推送未送达时继续打开系统分享面板。

## Alpha 10.1 P0.6 FCM 推送配置

当前第一套真实推送方案选择 Firebase Cloud Messaging（FCM）。APK 默认不启用 FCM，只有在构建时传入完整的公开 Firebase Android 配置后才会获取并注册设备 token：

```powershell
.\gradlew.bat assembleDebug `
  -PtongkanAccountApiBaseUrl=https://tongkan-personal.pages.dev/account-api `
  -PtongkanFcmApiKey=你的FirebaseWebApiKey `
  -PtongkanFcmApplicationId=你的FirebaseApplicationId `
  -PtongkanFcmProjectId=你的FirebaseProjectId `
  -PtongkanFcmSenderId=你的FirebaseMessagingSenderId
```

### 推荐：安全一键配置

先在 Firebase 控制台注册 Android 包名 `com.tongkan.mobile`，下载 `google-services.json`；再下载同一项目的服务账号 JSON。两份文件都必须放在仓库外，例如“下载”目录或 `C:\tmp`。

先只校验文件是否匹配，不构建、不修改 Cloudflare：

```powershell
pnpm fcm:configure -- `
  -GoogleServicesJson "C:\tmp\firebase\google-services.json" `
  -ServiceAccountJson "C:\tmp\firebase\firebase-service-account.json" `
  -ValidateOnly
```

校验通过后去掉 `-ValidateOnly`。脚本会依次完成：

1. 运行 Android 单元测试、Lint 和带 FCM 参数的 APK 构建。
2. 把 `FCM_PROJECT_ID`、`FCM_CLIENT_EMAIL`、`FCM_PRIVATE_KEY` 写入 Cloudflare Secret，不回显值。
3. 部署 Account Worker 并检查生产健康状态。
4. 生成 `release/tongkan-android-<版本>-fcm.apk`，计算 SHA-256，并在资源管理器中选中文件。

脚本拒绝读取仓库内的 Firebase 文件；`.gitignore` 也会拦截常见文件名，避免服务账号私钥误入 Git。

- `tongkanFcmApiKey`、`tongkanFcmApplicationId`、`tongkanFcmProjectId` 和 `tongkanFcmSenderId` 是 Firebase 客户端配置，不是服务端私钥。
- App 进程启动时由 `TongkanApplication` 初始化 Firebase，保证没有 `google-services.json` 的构建参数模式也能处理冷启动推送。
- Android 登录成功、恢复登录和回到前台时刷新 token；FCM 后台回调产生新 token 时也会立即上传，token 变化会先注销旧 token，再注册新 token。
- Android 13（API 33）及以上只在 FCM 已配置时请求 `POST_NOTIFICATIONS` 权限。
- FCM 通知数据必须包含经过服务端校验的 `https://tongkan-personal.pages.dev/room/{roomId}#join={inviteKey}`；点击后进入现有加入房间流程。
- FCM 服务账号私钥只配置在 Cloudflare Worker Secret，不能写进 `google-services.json`、APK、Git 或聊天记录。
- 生产 Account Worker 已配置 Firebase 服务账号并启用 `PUSH_PROVIDER=fcm`；`1.0.0-alpha10.1-p0.6-fcm` 已注入匹配的 Android 客户端参数。真实送达、后台通知和点击进入房间仍需两部支持 FCM 的 Android 设备完成验收；发送失败时系统分享兜底保持可用。
