# 直接依赖与许可证清单

> 本文件由 `pnpm deps:report` 根据各 workspace 的 `package.json` 和当前安装结果生成，请勿手工编辑。CI 使用 `pnpm deps:check` 防止清单过期。

| 包 | 声明版本 | 已安装版本 | 许可证 | 用途 | 使用方 |
| --- | --- | --- | --- | --- | --- |
| `@cloudflare/workers-types` | ^4.20250803.0 | 4.20260702.1 | MIT OR Apache-2.0 | development | @tongkan/signaling |
| `@fontsource-variable/geist` | ^5.2.6 | 5.3.0 | OFL-1.1 | production | @tongkan/web |
| `@fontsource/jetbrains-mono` | ^5.2.6 | 5.3.0 | OFL-1.1 | production | @tongkan/web |
| `@types/react` | ^19.1.10 | 19.2.18 | MIT | development | @tongkan/web |
| `@types/react-dom` | ^19.1.7 | 19.2.4 | MIT | development | @tongkan/web |
| `@vitejs/plugin-react` | ^4.7.0 | 4.7.0 | MIT | development | @tongkan/web |
| `lucide-react` | ^0.539.0 | 0.539.0 | ISC | production | @tongkan/web |
| `react` | ^19.1.1 | 19.2.8 | MIT | production | @tongkan/web |
| `react-dom` | ^19.1.1 | 19.2.8 | MIT | production | @tongkan/web |
| `typescript` | ^5.9.2 | 5.9.3 | Apache-2.0 | development | @tongkan/protocol, @tongkan/signaling, @tongkan/web, tongkan |
| `vite` | ^7.1.2 | 7.3.6 | MIT | development | @tongkan/web |
| `vitest` | ^3.2.4 | 3.2.7 | MIT | development | @tongkan/protocol, @tongkan/signaling, @tongkan/web, tongkan |
| `wrangler` | ^4.28.1 | 4.118.0 | MIT OR Apache-2.0 | development | @tongkan/signaling |

## 范围与解释

- 仅列出直接外部依赖；`workspace:*` 内部包和传递依赖不在本表中。
- 许可证来自已安装包的 `package.json` 元数据，不构成法律意见。
- 生产部署和发布前仍应保留 `pnpm-lock.yaml`，并审查 Dependabot 提出的版本变化。
- 出现 `UNKNOWN` 或 `not installed` 时不得忽略，应先确认包元数据或重新安装依赖。
