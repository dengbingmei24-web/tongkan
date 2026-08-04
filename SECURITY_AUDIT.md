# 同看只读安全审计

- 审计日期：2026-08-04
- 审计范围：Web 房间客户端、Manifest V3 扩展、Cloudflare Worker / Durable Object、共享协议和环境变量
- 审计方式：静态代码审查、现有测试核对与敏感文件检查
- 约束：本轮只记录问题和建议，没有修改核心协议或运行逻辑

## 结论

未发现已经进入 Git 的私钥或部署凭据。房间标识、房主密钥和邀请密钥均使用 128 位随机值；密钥通过 URL fragment 传递，不会作为 HTTP Referer 发送；固定房主/访客席位、同席位新连接替换旧连接、聊天不持久化等控制已经存在。

当前记录 1 项高风险、4 项中风险和 2 项低风险。最优先的是限制扩展网页桥接的来源和权限范围。

## 发现

### S-01 高风险：任意网页可以向扩展桥接发送伪造控制消息

证据：

- `apps/extension/manifest.json` 将 `web-bridge.js` 注入 `<all_urls>`，并申请 `<all_urls>` host permission。
- `apps/extension/src/web-bridge.js` 只检查 `event.source` 和可伪造的 `event.data.source === "tongkan-web"`，没有校验 `event.origin`。
- `apps/extension/src/background.js` 接收 `ROOM_BIND` 与 `APPLY_ANCHOR` 时没有校验 `sender.tab.url`、房间页面来源或 `canonicalUrl`。

影响：安装扩展后访问恶意网页，该网页可以伪装成同看房间页、绑定自身标签页、向扩展发送权威锚点，并促使扩展更新现有 B站标签页或打开攻击者提供的 URL。它也可以接收扩展转发的本地播放事件。

建议：将内容脚本与 host permission 限制到明确的同看 Web 来源和 B站来源；桥接层校验 `event.origin`；后台再次校验 `sender.tab.url`、消息结构、房间 ID 和 B站 canonical URL。部署域名未确定前，可以通过构建时允许列表管理开发与生产来源。

### S-02 中风险：房间创建接口可被任意网站跨域批量调用

证据：`apps/signaling/src/worker.ts` 对所有 JSON 响应设置 `access-control-allow-origin: *`，`POST /api/rooms` 没有来源限制、速率限制或滥用配额。

影响：第三方网页可以利用访问者浏览器批量创建 Durable Object 房间，造成存储和请求成本增加。该问题不会直接泄露其他房间密钥，但会形成资源消耗入口。

建议：生产环境使用 Web 来源允许列表；对创建房间接口增加按 IP / 时间窗口的限流、Cloudflare WAF 规则或 Turnstile；监控房间创建速率。

### S-03 中风险：房间、密钥和播放元数据没有过期清理

证据：`apps/signaling/src/room-session.ts` 的序列化状态包含房主密钥、邀请密钥、成员信息和播放锚点；`apps/signaling/src/worker.ts` 持久化后没有 Durable Object alarm、TTL 或双方离开后的删除逻辑。

影响：已结束房间的访问密钥、成员昵称和播放信息会长期保留，增加隐私暴露面和存储成本，也未达到 PRD 中双方离开 10 分钟后销毁的要求。

建议：记录最后活动时间，双方离线后设置 alarm；到期清除 Durable Object storage，并增加生命周期测试。

### S-04 中风险：直链视频完整 URL 会随房间状态长期持久化

证据：`DirectMediaIdentity.url` 保存完整地址，播放锚点由 `RoomSession.serialize()` 写入 Durable Object。产品允许用户输入可能包含签名查询参数的视频直链。

影响：临时签名、访问令牌或私人资源路径可能被作为房间元数据保存；与 S-03 的无过期机制组合后风险更高。

建议：界面明确禁止带敏感查询参数的链接；优先仅保存必要媒体标识；若必须保存完整 URL，则缩短房间 TTL，并在日志、Issue 和验收记录中统一脱敏。

### S-05 中风险：服务端信任 TypeScript 类型，缺少运行时消息校验和大小限制

证据：`apps/signaling/src/worker.ts` 对 WebSocket 消息执行 `JSON.parse` 后直接断言为 `ClientMessage`；昵称、聊天、RTC SDP / candidate 和播放上报没有统一 schema、字符串长度或消息体大小验证。

影响：持有房间密钥的异常或恶意客户端可以发送错误类型、超大 SDP / 文本或非有限数值，引发 Durable Object 异常、对端消息洪泛或资源消耗。

建议：在协议包增加运行时 schema；设置 WebSocket 单条消息上限；拒绝 `NaN` / `Infinity`、超长字符串和未知字段；为错误消息增加测试。

### S-06 低风险：只有 seek 操作具备服务端速率限制

证据：`RoomSession.allowSeek()` 将拖动限制为每秒两次，但聊天、播放上报、ping、屏幕共享和 RTC signal 没有对应频率限制。

影响：已认证成员可以向 Durable Object 和另一端持续发送大量事件，影响单个房间稳定性并增加请求成本。

建议：按成员和消息类型增加轻量令牌桶；优先限制聊天、播放报告和 RTC candidate 洪泛。

### S-07 低风险：房间凭据持续保存在地址栏和 localStorage

证据：`apps/web/src/room-client.ts` 从 URL fragment 读取密钥并写入 localStorage；加入后没有使用 `history.replaceState` 清理 fragment。

影响：密钥不会进入 Referer，但可能出现在地址栏截图、复制出的当前页面地址、浏览器历史或同源脚本可读的 localStorage 中。若未来发生同源 XSS，持久化密钥会扩大影响。

建议：成功保存身份后立即清理 fragment；在产品中提供退出并删除本地身份；生产 Web 增加严格 CSP，减少第三方脚本。

## 建议处理顺序

1. S-01：收紧扩展来源、权限和后台消息校验。
2. S-03 / S-04：实现房间 TTL，并处理直链 URL 隐私。
3. S-02：部署前增加创建房间限流和来源允许列表。
4. S-05 / S-06：增加运行时 schema、大小和频率限制。
5. S-07：清理 fragment、增加退出清理和 CSP。

修复安全问题时应逐项单独提交，并为每项增加回归测试，避免一次性改变房间协议、扩展路由和部署配置。
