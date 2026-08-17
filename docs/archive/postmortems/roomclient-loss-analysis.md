# RoomClient.java 功能丢失根因分析

**日期**: 2026-08-06  
**损失**: Alpha 2/3 新增的 7 项功能在网络编码混乱中丢失  
**恢复**: 手动重建完整文件（316行），13 项单元测试验证通过

---

## 直接原因

**Git 仓库只存了 Alpha 1 的代码**。Alpha 2/3 的改动（IPv4/IPv6 DNS 轮换、Origin 头、networkErrorMessage、
NPE 防护、lastNetworkError 字段、connect() try-catch、setDnsResolver）全在未提交的工作区中。

当文件因编码问题被破坏后，`git checkout` / `git cat-file -p HEAD` 只能恢复到 Alpha 1 状态。

```
Alpha 1 (已提交)        Alpha 2 ~ Alpha 6 (未提交)
├─ createRoom           ├─ DNS resolver (IPv4/IPv6轮换)
├─ connect/WebSocket    ├─ Origin 头
└─ 基础消息处理          ├─ networkErrorMessage 错误诊断
                        ├─ NPE 防护 (java-websocket bug)
                        ├─ lastNetworkError 字段
                        ├─ setDoOutput(true) 修复
                        └─ super.onCreate(null) 防闪退

  → git checkout 只能恢复到左边 ←
```

## 为什么没提交

CONTEXT.md 里写的是「标记分支/构建但不要 commit（除非用户明确要求）」。
这条规则针对的是不想频繁 commit 的场景，但副作用是：**git 作为安全网失效了**。

## 编码问题的连锁反应

```
PowerShell Set-Content(xml) → 破坏 UTF-8 → 文件编译失败
  → git checkout 恢复 → 回退到 Alpha 1（丢失新功能）
    → 反复修补 → Node.js 中文路径失败 → 再次 git checkout → 循环
```

每次用 `git checkout` 试图"恢复到干净状态"，其实是在**丢失更多未提交的工作**。

## 教训和规则

1. **代码改动达到可运行状态后立即 commit**（至少 `git add` + `git stash`）
2. **修改有中文的文件用 `C:\tmp\android-patch\` 中转**，Node.js 不直接操作中文路径
3. **验证修改是否生效**：直接查看 tmp build 目录下的文件，不要信任工具链返回
4. **`git checkout` 是破坏性操作**：执行前先确认有未提交工作，先 stash
5. **关键文件的完整副本应独立保存**：在 `C:\tmp\android-patch\` 保留一份已验证的版本