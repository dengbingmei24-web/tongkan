# Tongkan Account Worker

Alpha 10 账号、邮箱验证码、唯一好友和设备邀请服务。

## 本地开发

1. 复制 `.dev.vars.example` 为 `.dev.vars`，只在本机填写 Secret。
2. 在仓库根目录运行 `pnpm install`。
3. 运行 `pnpm --filter @tongkan/account db:local` 应用本地 migration。
4. 运行 `pnpm --filter @tongkan/account dev` 启动 Worker。

`AUTH_TEST_MODE=true` 只用于隔离预览环境，会在验证码响应中返回 `debugCode`；生产环境必须保持 `false`。

## 生产 Secret

使用 `wrangler secret put` 配置，禁止写入 Git、APK、日志或上下文文档：

- `EMAIL_HMAC_SECRET`
- `AUTH_SECRET`
- `SESSION_SECRET`
- `SMTP_USERNAME`
- `SMTP_AUTHORIZATION_CODE`
- `SMTP_FROM`
- `FCM_PROJECT_ID`
- `FCM_CLIENT_EMAIL`
- `FCM_PRIVATE_KEY`

QQ 邮箱使用 SMTP 授权码而不是登录密码；当前适配器连接 `smtp.qq.com:465` 隐式 TLS。

## 主要接口

- `POST /api/auth/send-code`
- `POST /api/auth/verify-code`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/me`
- `POST /api/pair/invites`
- `POST /api/pair/invites/{code}/accept`
- `GET /api/pair`
- `POST /api/devices/register`
- `POST /api/devices/unregister`
- `POST /api/pair/watch-invites`

设备 token 使用 HMAC 索引和 AES-GCM 加密值保存。邀请接口只允许向当前唯一好友的活动设备发送经过校验的同看房间深链；没有可用设备或推送失败时返回 `fallbackRequired: true`，Android 必须继续系统分享。

## FCM 配置

推荐在仓库根目录运行：

```powershell
pnpm fcm:configure -- `
  -GoogleServicesJson "C:\path\outside-repo\google-services.json" `
  -ServiceAccountJson "C:\path\outside-repo\firebase-adminsdk.json"
```

脚本会校验 Android 包名和 Firebase 项目匹配，运行 Android 测试/Lint/构建，通过 stdin 写入三个 Cloudflare Secret，部署 Worker、检查生产健康状态并打开 FCM APK。两份 JSON 必须位于仓库外。

生产环境已于 2026-08-14 配置 FCM Secret，并部署 Worker 版本 `7dbd0456-b2ed-431f-810b-42cd1e1d13cf`。Google OAuth 与 FCM HTTP v1 鉴权冒烟检查通过；真实双设备送达仍待物理验收。

未配置 Firebase 参数时，Android 使用 No-op token Provider；服务端发送失败时系统分享兜底保持可用。
