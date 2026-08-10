# 同看版本发布指南

## 保存原则

- **Git 提交保存源码和文档**：不要用新文件覆盖旧历史，也不要强制重写已经推送的提交。
- **Git 标签固定版本**：每个已发布标签不可移动或复用。出现问题时发布更高版本。
- **GitHub Release 保存 APK**：`release/` 是本地构建目录并被 Git 忽略，APK 不进入仓库历史。
- **Alpha 版本标记为 prerelease**：正式稳定版使用长期 Release 签名后再取消预发布标记。

## 版本规则

Android 配置位于 `apps/android/app/build.gradle`：

- `versionCode`：每次发布必须加 1，只能递增。
- `versionName`：例如 `1.0.0-alpha.9.2`。
- Git 标签：在 `versionName` 前加 `v`，例如 `v1.0.0-alpha.9.2`。

建议后续版本：

- 小修复：`1.0.0-alpha.9.3`。
- 新增互动或聊天：`1.0.0-alpha.10`。
- 核心功能稳定后：`1.0.0-beta.1`。
- 使用正式签名并完成回归后：`1.0.0`。

## 每次发布步骤

1. 更新 `apps/android/app/build.gradle` 的 `versionCode` 和 `versionName`。
2. 更新 `CHANGELOG.md`、`README.md` 和 `CONTEXT.md`。
3. 运行 `pnpm android:check`。
4. 提交源码：`git commit -m "release: Android <version>"`。
5. 推送提交：`git push origin master`。
6. 创建标签：`git tag -a v<version> -m "同看 Android <version>"`。
7. 推送标签：`git push origin v<version>`。
8. GitHub Actions 自动测试、构建并创建 Release；在 Actions 和 Releases 页面确认结果。

## 回滚和修复

- 不删除旧 Release，不替换旧标签中的 APK。
- 需要回滚时直接安装旧 Release 的 APK。
- 已发布版本出现问题时提高 `versionCode` 并发布新标签。
- 标签推送后若工作流失败，修复代码并发布新版本；只有在 Release 尚未创建且标签指向错误提交时，才人工处理错误标签。
