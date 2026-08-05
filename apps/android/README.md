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

首次构建需要联网下载 Gradle、Android 插件和 Maven 依赖。Android Studio 用户可以直接打开 `apps/android`，等待 Gradle Sync 完成后运行相同任务。

## 自动 CI

`.github/workflows/android.yml` 会在 Android、共享协议夹具或协议校验代码发生变化时自动运行全部检查，并上传 APK、JUnit 报告和 Lint 报告。
