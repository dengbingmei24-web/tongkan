# Android 协议契约夹具

这些 JSON 文件同时由 Android JUnit 测试和 signaling Vitest 读取。

- Android 端必须生成与夹具结构一致的客户端消息，并能解析权威播放锚点。
- signaling 端必须继续接受所有 Android 客户端消息夹具。
- 修改协议字段时应先更新共享 TypeScript 类型和服务端校验，再同步更新这些夹具与 Android 实现。
