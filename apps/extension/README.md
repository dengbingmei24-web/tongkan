# 同看浏览器扩展

1. 在仓库根目录运行 `pnpm --filter @tongkan/extension build`。
2. 打开 Chrome/Edge 的扩展管理页并启用开发者模式。
3. 选择“加载已解压的扩展程序”，指向本目录下的 `dist`。
4. 同时保留同看房间页和对应的 B站视频页。

扩展不单独连接信令服务器。房间网页负责收发服务端序号，扩展仅在本机转发播放器事件和应用权威播放锚点。

扩展后台会把房间标签、B站标签和最新权威锚点保存在 `chrome.storage.session`。Manifest V3 Service Worker 被浏览器休眠或重启后，会自动恢复转发状态，不需要重新进入房间。

## 本地签名文件

Chrome/Edge 打包扩展时可能生成 `.pem` 私钥和 `.crx` 安装包。这两类文件仅保留在本机，已由仓库根目录的 `.gitignore` 排除，禁止提交、上传或通过聊天工具分享。开发时直接加载 `apps/extension/dist`，不需要签名私钥。
