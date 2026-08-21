# 同看公网部署与移动端路线
## 当前结论

当前版本的房间、B站桌面同步、视频直链和桌面屏幕共享已经形成基础闭环。公网化以后，电脑和手机都可以打开房间网页；但手机浏览器不能安装 Edge 扩展，所以手机端暂时只能使用创建/加入房间、聊天、观看对方共享画面和浏览器可直接播放的视频。B站的双向原生控制需要在 Android App 阶段由 App 内桥接替代桌面扩展。

## 一、准备 Cloudflare

1. 注册或登录 Cloudflare。
2. 在项目根目录执行：

```powershell
pnpm --filter @tongkan/signaling exec wrangler login
```

3. 确定正式网页地址：

- 网页地址，例如 `https://tongkan-yourname.pages.dev`

生产环境不能使用 `localhost`、HTTP 或通配符来源。正式网页默认通过 Pages Function 的 Service Binding 在 Cloudflare 内部访问信令 Worker，浏览器不直接访问可能受网络限制的 `workers.dev` 域名。

## 二、只生成生产文件

```powershell
pnpm release:prepare -- --web-origin https://tongkan-yourname.pages.dev --signaling-origin https://tongkan-yourname.pages.dev
```

生成内容位于本地 `release/`：

- `web/`：可部署的网页静态文件
- `extension-unpacked/`：Edge“加载解压缩的扩展”使用的目录
- `tongkan-edge-extension.zip`：复制到另一台电脑的扩展压缩包
- `release-info.json`：本次构建所使用的公开地址与扩展版本

如果需要 TURN，可以追加 `--ice-servers '<RTCIceServer[] JSON>'`。TURN 凭据会进入浏览器构建产物，本质上是客户端可见信息，应使用可轮换的短期凭据，不要放长期管理密钥。

## 三、一键部署 Worker、网页并打包扩展

随后运行：

```powershell
pnpm deploy:cloudflare -- --web-origin https://tongkan-yourname.pages.dev --pages-project tongkan-yourname
```

脚本依次执行：

1. 部署 Durable Objects 信令 Worker，并只允许正式网页来源访问。
2. 使用 Pages 同域 HTTPS/WSS 地址构建网页，由 Pages Function 将 `/api/*` 与 `/rooms/*` 转发到信令 Worker。
3. 使用正式网页来源构建 Edge 扩展并生成 ZIP。
4. 将网页发布到 Cloudflare Pages。

部署后需要在两台电脑上重新加载 `release/extension-unpacked/`，旧的本地扩展只允许 `localhost`，不能控制公网房间。

## 四、移动网页验收边界

公网网页发布后，先在手机上验收：

- 可以创建房间、复制邀请链接和加入房间。
- 页面在竖屏下没有横向溢出，按钮可触摸操作。
- 可以收发聊天消息。
- 可以观看桌面端发起的屏幕共享。
- 可以加载手机浏览器支持的 MP4/WebM 直链并同步操作。
- 明确提示“手机网页暂不支持 B站双向控制”，不能显示虚假的已同步状态。

手机浏览器发起整机屏幕共享受 iOS/Android 浏览器权限限制，不作为移动网页阶段的承诺。

## 五、Android App 路线

Android 优先，复用现有 React 房间界面和协议包：

1. 用 Capacitor 建立 App 外壳，网页和 App 共用房间协议、信令和大部分 UI。
2. 增加 App 内 B站 WebView 控制桥，承担桌面扩展在电脑上的职责。
3. 使用 Android MediaProjection 实现整机屏幕共享；系统声音是否可捕获由 Android 版本、厂商和被共享 App 决定。
4. 将 WebRTC、前后台恢复、音频焦点和通知做成原生插件。
5. Android 与桌面完成播放、暂停、拖动、倍速、断线恢复和屏幕共享交叉验收。

B站页面结构和 WebView 策略可能变化，因此 App 必须保留“打开 B站 App/浏览器 + 房间遥控器”以及屏幕共享降级路径，不通过抓取或重新分发受保护视频流实现同步。

## 六、推荐开发顺序

1. 完成公网部署和生产扩展打包。
2. 做手机网页响应式与只读/降级状态验收。
3. 建立 Android Capacitor 工程和 App 登录房间壳层。
4. 开发 Android B站 WebView 控制桥。
5. 开发 Android MediaProjection 屏幕共享。
6. 配置 TURN，完成不同网络和移动网络验收。


## 七、Alpha 10 账号服务

账号服务位于 `apps/account/`，与房间信令 Worker 分离。正式部署前依次执行：

```powershell
pnpm --filter @tongkan/account db:remote
pnpm --filter @tongkan/account exec wrangler secret put EMAIL_HMAC_SECRET
pnpm --filter @tongkan/account exec wrangler secret put AUTH_SECRET
pnpm --filter @tongkan/account exec wrangler secret put SESSION_SECRET
pnpm --filter @tongkan/account exec wrangler secret put SMTP_USERNAME
pnpm --filter @tongkan/account exec wrangler secret put SMTP_AUTHORIZATION_CODE
pnpm --filter @tongkan/account exec wrangler secret put SMTP_FROM
pnpm --filter @tongkan/account exec wrangler deploy --env=""
```

生产环境固定 `AUTH_TEST_MODE=false`。QQ 邮箱使用 SMTP 授权码，不使用邮箱登录密码。默认连接 `smtp.qq.com:465` 隐式 TLS；2026-08-13 已通过 Cloudflare HKG 边缘定时探针收到 QQ Mail `220` 欢迎语，耗时约 1.16 秒。真实投递、鉴权错误和频率限制仍需在用户提供专用发件邮箱及授权码后验证。

预览环境使用 `tongkan-account-preview` D1 和 `AUTH_TEST_MODE=true`，只用于开发验证，不能作为公开生产登录入口。`.dev.vars` 和所有 Secret 值均被 Git 忽略。

### Alpha 10.2.4 生产状态（2026-08-19）

- 生产 D1 `tongkan-account` 已在迁移前导出私密备份到仓库外临时目录。
- `0004_pair_archives.sql`、`0005_shared_library.sql` 与 `0006_active_pair_rooms.sql` 已成功应用，远程迁移列表为空。
- 生产 Account Worker 当前活动版本为 `519be06a-5d10-4f8e-ba69-a00e7216493e`，100% 流量，`AUTH_TEST_MODE=false`。
- 正式 Pages 入口 `/account-api/health` 返回 200/`testMode=false`；`/account-api/api/library` 与 `/account-api/api/pair/active-room` 未登录均返回 401 `AUTH_REQUIRED`。
- 日常 APK 使用 `https://tongkan-personal.pages.dev/account-api`、公开 FCM 客户端配置和空 Preview 令牌。
- 当前 APK 仍为 Debug 签名；双设备片库、FCM 与完整 Beta 物理验收因没有第二位测试者延期。
- Android 当前交付 APK 为 1.0.0-alpha10.2.4 / versionCode 40，SHA-256 `64D6530D50E127528CA0BD57E9F2F04C37E20EAB25E9F174BDB11C0581A09BA6`；生产 API、FCM 配置完整且 Preview 令牌为空。
- Preview Account Worker 当前版本为 `439139cb-ab48-4f72-a3f5-3012d6c37477`；Preview D1 已应用 `0007_calendar_plans.sql`，生产 D1 仍停留在 `0006_active_pair_rooms.sql`。2026-08-21 Preview 健康检查返回 200/`testMode=true`，Calendar Live QA 16/16 与 20/20 revision race 通过，夹具已清理且测试密钥已轮换。

### 账号预览联调

账号联调环境使用独立 Worker `tongkan-account-preview` 和独立 D1，通过 Pages Service Binding 暴露为同域 `/account-api/*`：

- `apps/web/functions/_middleware.js` 将 `/account-api` 前缀移除后转发到 `ACCOUNT` binding。
- 当前受保护 Preview 网关为 `https://tongkan-account-preview-gateway.pages.dev/account-api`；旧的 `account-preview.tongkan-personal.pages.dev` 不存在，QA allowlist 已同步到实际网关。
- 预览 Worker 关闭 `workers.dev` 和 Preview URL，不提供独立公网入口。
- 除 `/health` 外，预览 API 要求 `X-Tongkan-Test-Key`；令牌只存 Cloudflare Secret 和仓库外临时构建目录。
- 预览模式返回 `debugCode`，不发送邮件，数据只写入 `tongkan-account-preview`。
- 联调 APK 会包含可提取的临时测试令牌，因此只能用于小范围测试；完成真实 SMTP 后必须轮换/删除令牌并构建不含测试令牌的正式包。

### Alpha 10.2.4 活跃房间迁移

本版本新增 `apps/account/migrations/0006_active_pair_rooms.sql`。2026-08-19 已在用户明确授权后完成生产备份、migration 与 Worker 部署；以下命令保留为运维记录：

```powershell
pnpm --filter @tongkan/account db:preview
pnpm --filter @tongkan/account deploy:preview

# 生产执行记录（已于 2026-08-19 获得授权并完成）
pnpm --filter @tongkan/account db:remote
pnpm --filter @tongkan/account exec wrangler deploy --env=""
```

发布后验证：当前 pair 的房主可以 POST，房主 GET 返回 `room: null`，好友 GET 返回 guest URL，第三账号返回 `PAIR_REQUIRED`，DELETE/过期/解绑后好友 GET 返回 `room: null`。D1 的 `invite_url_ciphertext` 不得包含明文 invite key，任何响应不得出现 host key。
