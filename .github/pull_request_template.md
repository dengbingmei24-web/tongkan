## 变更目的

说明要解决的问题、用户影响和不在本次范围内的内容。

- Spec Kit 功能目录：
- Worker 任务合同 / Issue：
- 基线提交：
- 当前分支：

## 变更范围

- 涉及模块：Android / Account Worker / Web / 扩展 / 信令 / 协议 / CI / 文档
- 是否改变协议或持久化数据：是 / 否
- 是否改变环境变量、扩展权限或部署配置：是 / 否

## 验证

- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] `pnpm test:integration`，或已说明无法执行的原因
- [ ] 若涉及 Android，已运行 `pnpm android:check`
- [ ] 若涉及账号服务，已运行 Account Worker typecheck/test/build
- [ ] `git diff --check` 通过
- [ ] 已运行凭据扫描；没有真实邮箱、授权码、私钥、Session/device token 或构建产物
- [ ] 若涉及 D1，已说明迁移文件和生产/预览迁移状态（执行任务不得自行应用）
- [ ] 修改依赖后已运行 `pnpm deps:report`
- [ ] UI 变化已完成键盘、焦点和窄屏检查

## 安全与隐私

- [ ] 没有提交房间密钥、TURN 凭据、`.env`、SMTP 授权码、Cloudflare Secret、Firebase 服务账号、Session/device token、扩展 `.pem`、APK、构建产物或带签名参数的视频 URL
- [ ] 已检查消息来源、运行时输入、日志和持久化数据的影响
- [ ] 若涉及安全审计发现，已注明 `SECURITY_AUDIT.md` 的编号

## 人工验收与证据

- 对应验收记录或 Issue：
- 截图、录屏或日志：
- 已知限制和回滚方式：

## 执行任务交接

- [ ] 修改仅位于任务合同允许的写入范围。
- [ ] 未修改 `CONTEXT.md`、`DECISIONS.md`、`PROJECT_CONTEXT.md`、全局 PRD、生产配置或部署状态；这些路径不能授权给执行任务。
- [ ] 已列出提交哈希、修改文件、验证结果、风险和未完成项。
- [ ] 此 PR 保持 Draft，直到审查任务给出 `APPROVED`。
