# Antigravity Restrictions Bypass (agy 内核限制突破与规避指南)

本仓库专门记录 Google Antigravity CLI (`agy.exe`) 内部各项限制机制的逆向分析依据、防御机制解构、实测复盘与补丁工具集。

---

## 议题索引

| 议题 | 状态 | 核心机理 | 解决方案 / 结论 | 详细文档 |
| :--- | :---: | :--- | :--- | :--- |
| **议题一：拦截自动上下文压缩**<br>*(Checkpointer Context Compaction)* | ❌ 彻底失败<br>(已封存) | Cortex 引擎底层 Go 调度链路，不走外部 ToolCall；强改配置触发转换层死锁或触碰云端 KV Cache 硬边界 | 无法也不建议拦截。保持官方原生 Checkpoint 流程，彻底回退所有打桩改动 | [01-context-compaction-interception.md](docs/01-context-compaction-interception.md) |
| **议题二：移除工作区规则字节截断**<br>*(GEMINI.md / CLAUDE.md Rules)* | ✅ 完美攻克<br>(持续对齐) | 规则注入存在双层硬编码门禁：第一层单文件 24,000 字节换行截断，第二层规则集 20,000 Tokens 预算整条丢弃 | 双层纯数值等长机器码替换（放宽至 500,000 字节 + 200,000 Tokens），零控制流破坏，配金丝雀探针 | [02-workspace-rules-truncation-bypass.md](docs/02-workspace-rules-truncation-bypass.md) |

---

## 工具脚本目录 (`scripts/`)

- [scan-patch-sites.js](scripts/scan-patch-sites.js): 通用动态特征扫描脚本，通过机器码模式自动标定新版本 `agy.exe` 中 12 处修改点的物理文件偏移（FileRaw Offset）。
- [patch-agy-1.4.6.js](scripts/patch-agy-1.4.6.js): 针对 `agy` v1.4.6 的正式补丁落地脚本（含 SHA256 校验、12 处纯数值机器码等长写入、Windows 原子重命名替换）。
- [verify-patch-1.4.6.js](scripts/verify-patch-1.4.6.js): 对磁盘上修补后的 `agy.exe` 12 处修改点执行逐字节核验与文件体积验证。
- 历史版本存档：[patch-agy-1.4.4.js](scripts/patch-agy-1.4.4.js)、[patch-agy-1.4.3.js](scripts/patch-agy-1.4.3.js) 等。

---

## 架构原则与避坑红线

1. **零控制流破坏 (Zero Control Flow Disruption)**：
   绝不修改任何跳转指令（`cmp`、`jle`、`jmp`、`cmov`），仅以等长机器码放大立即数常量，严格保持 Go 运行时的调用约定、栈平衡与回溯链。
2. **原子文件替换 (Atomic File Replacement)**：
   Windows 环境下运行中的可执行文件受文件锁保护，必须通过原子重命名机制（`rename` 正在运行的原文件 -> 写入新文件）安全替换。
3. **备份先行与金丝雀锚点 (Backup First & Canary Probe)**：
   每次修改前必须校验官方出厂备份文件与 SHA256；工作区规则末尾部署金丝雀暗号（如 `AGY-CANARY-OMEGA-483`），一旦底层规则被腰斩能立即被 Agent 感知报警。
