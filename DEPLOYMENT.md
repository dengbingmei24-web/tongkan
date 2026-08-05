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
