# WebView 闪退根因分析报告 — 最终版

**结论**: `super.onCreate(null)` — 不恢复任何 `savedInstanceState`

## 为什么之前的方案都失败了

1. `savedInstanceState.remove()` 在 `super.onCreate` 之后 → 来不及，WebView 已在 super 中崩溃恢复
2. `savedInstanceState.remove()` 在 `super.onCreate` 之前 → Android 系统可能在其他时序重建
3. `onSaveInstanceState` 移除 → `super.onSaveInstanceState` 里面已经把状态写入了
4. 各种编码问题导致修改没真正生效

## 终极方案

```java
protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(null);  // 永远不恢复状态，WebView 每次都是新建的
    // ... 正常初始化
}
```

**代价**: 屏幕旋转/配置变化后状态丢失（本 App 已锁定竖屏，无影响）

**记忆**:
- WebView + savedInstanceState = 100% 会崩溃  
- 修复 WebView 崩溃的唯一可靠方案: super.onCreate(null)
- 验证修改是否生效: 直接看 tmp build 目录下的文件
- 修改文件: 复制到 C:\tmp\android-patch\ → Node.js 改 → 复制回来 → 立即验证