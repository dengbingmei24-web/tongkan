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

推送 `v*` 版本标签时，`.github/workflows/android-release.yml` 会再次执行完整检查，并自动创建带 APK 和 SHA-256 校验文件的 GitHub 预发布版。版本升级与标签规则见仓库根目录的 `RELEASING.md`。
