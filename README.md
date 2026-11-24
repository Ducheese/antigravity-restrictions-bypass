# Antigravity Restrictions Bypass (agy 内核限制突破与规避指南)

[English](README_EN.md) | [中文](README.md)

本仓库专门记录 Google Antigravity CLI (`agy.exe`) 内部各项限制机制的逆向分析依据、防御机制解构、实测复盘与补丁工具集。

---

## 议题索引

| 议题 | 状态 | 核心机理 | 解决方案 / 结论 | 详细文档 |
| :--- | :---: | :--- | :--- | :--- |
| **议题一：上下文容量扩容与压缩起爆线推迟**<br>*(Checkpointer & Context Window)* | ✅ 成功攻克<br>(动态跳板) | 官方后端在 `applyFeatureProviderCheckpointOverrideConfig` 最终出口强制覆写上限为 256k | 在配置最终合并出口借用未引用的 Setter 注入动态汇编跳板，保留原生 `hooks.checkpointNeeded` 防爆气囊，支持三档选择（512K/734K/983K） | [01-context-compaction-interception.md](docs/01-context-compaction-interception.md) |
| **议题二：移除工作区规则字节截断**<br>*(GEMINI.md / CLAUDE.md Rules)* | ✅ 完美攻克<br>(持续对齐) | 规则注入存在双层硬编码门禁：第一层单文件 24,000 字节换行截断，第二层规则集 20,000 Tokens 预算整条丢弃 | 基于 Go pclntab 动态符号解析，放宽单文件至 1MB 字节 + 规则总预算至 131,072 Tokens，零控制流破坏，配金丝雀探针 | [02-workspace-rules-truncation-bypass.md](docs/02-workspace-rules-truncation-bypass.md) |

---

## 工具脚本目录 (`scripts/`)

- **[patch-context.py](scripts/patch-context.py)**: **全版本通用动态补丁工具**（Python 3，零外部依赖）。基于 Go pclntab 动态符号解析与出口跳板挂载，单脚本同时完成【上下文扩容】（推迟 256K 压缩起爆线至 512K/734K/983K）与【规则门禁放宽】（放宽单文件规则至 1MB，规则总预算至 131K Tokens），彻底解决规则截断与上下文早压缩问题。
  - 支持三档选择：**Tier 1（512K 推荐主力档）**、**Tier 2（734K 进阶高容档）**、**Tier 3（983K 极限长对话档）**。
  - `python scripts/patch-context.py --status`：只读查看当前后端与近期会话数据库进度
  - `python scripts/patch-context.py --tier 1 -y`：一键打入 512K 推荐档与规则放宽（默认全量修补）
  - `python scripts/patch-context.py --tier 1 --skip-rules -y`：仅打上下文，不碰规则
  - `python scripts/patch-context.py --restore -y`：一键恢复原版
- **[verify_session.py](scripts/verify_session.py)**: **会话底层元数据核验工具**（Python 3）。直接解码 SQLite `gen_metadata` 与 `executor_metadata` Protobuf 二进制数据，实时展示当前会话真实请求上限与进度条。

---

## 架构原则与避坑红线

1. **零控制流破坏 (Zero Control Flow Disruption)**：
   绝不修改任何跳转指令（`cmp`、`jle`、`jmp`、`cmov`），仅以等长机器码放大立即数常量，严格保持 Go 运行时的调用约定、栈平衡与回溯链。
2. **原子文件替换 (Atomic File Replacement)**：
   Windows 环境下运行中的可执行文件受文件锁保护，必须通过原子重命名机制（`rename` 正在运行的原文件 -> 写入新文件）安全替换。
3. **备份先行与金丝雀锚点 (Backup First & Canary Probe)**：
   每次修改前必须校验官方出厂备份文件与 SHA256；工作区规则末尾部署金丝雀暗号（如 `AGY-CANARY-OMEGA-483`），一旦底层规则被腰斩能立即被 Agent 感知报警。
