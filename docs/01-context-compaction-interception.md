# 议题一：拦截 AGY 自动上下文压缩（失败复盘）

## 一、 问题背景与诉求

Google Antigravity CLI (`agy.exe`) 基于 Go 语言编写，内置了基于 Token 水位的自动上下文压缩机制（Checkpointer）。在长会话运行中，当上下文 Token 达到一定水位（如默认 256k 上限，叠加 15% overhead 约 289k~294k）时，系统会在后台静默向模型发起会话摘要请求，将活体上下文压扁回初始状态（约 20k~30k），早期消息被移出活跃上下文。

最初设想：能否通过配置、环境变量或二进制补丁彻底阻止系统触发自动压缩，保持全量超长上下文？

---

## 二、 探索路径与逐一触礁实测

### 1. 尝试通过 `hooks.json` 外部生命周期钩子拦截（失败）
- **现象**：在 `PreToolUse` 或生命周期脚本中尝试拦截压缩动作，没有任何事件被捕获。
- **逆向实证**：Checkpoint 根本不是 ToolCall 工具调用，而是注册在 Cortex 引擎内部的调度钩子：
  - `google3/third_party/jetski/cortex/executors/posthooks.NewCheckpointHook.func1`
  - `google3/third_party/jetski/cortex/executors/prehooks.NewCheckpointHook.func1`
- **结论**：每个交互回合结束后由底层直接驱动，外部脚本 Hook 完全无法感知更无法拦截。

### 2. 尝试通过官方环境变量 `AGY_CLI_AUTO_COMPACT_OVERRIDE` 扩容（失败）
- **现象**：将环境变量设置为 `2000000000`（20 亿 Tokens），长会话在突破 256k 时依然准时触发 `CHECKPOINT` 压缩。
- **逆向实证**：汇编深度追踪表明，该环境变量仅服务于 `jetski/cli/store` 模块，专门控制用户主动发起的 `/compact` 命令阈值；而后台自动压缩的真凶是独立的 `cortex/checkpoint` 决策模块，根本不读取该变量。

### 3. 尝试通过 `settings.json` 配置 `"contextWindow": "900K"`（失败）
- **现象**：界面 UI 分母成功显示为更大容量，但底层物理达到 256k 附近依然照样压缩。
- **逆向实证**：该参数仅用于前端会话展示模型（UI 渲染），底层的 `checkpoint.shouldCheckpoint` 读取的是独立的硬编码模板（依然为 `256,000` Tokens）。

### 4. 尝试直接二进制打桩置 `enabled: false`（引发灾难性死锁）
- **现象**：将 15 组内置 Checkpoint 模板的 `enabled` 强行设为 `false` 后，压缩虽然没有被触发，但终端陷入灾难性死锁：**无限反复打印 `conversation compaction` 分隔符，并死循环重试输出上一句未完成的回答，上下文彻底锁死**。
- **逆向实证**：
  1. 下游请求转换层 `TrajectoryChatConverter` 内部包含布尔字段 `ErrorOnTruncationWithoutCheckpoint`；
  2. 当上下文达到 256k 预算上限后，转换器准备裁减早期消息，但发现会话没有任何历史 Checkpoint 锚点；
  3. `ErrorOnTruncationWithoutCheckpoint` 严格抛错：`"no messages fit the executor budget"`；
  4. 上层执行器收到错误后判定必须紧急执行压缩，打印提示并调用 Checkpointer；
  5. 但 Checkpointer 已被置为 `false` 拒绝生成 Checkpoint，导致错误无法解除，触发重试循环；
  6. 重试再次调用转换器，再次抛错，进入无限死循环。

### 5. 云端服务体系硬约束
- Antigravity 客户端深度依赖 Google 云端网关、TPU KV Cache 与配额计费体系；
- 即使客户端局部抹平了全部比较分支，云端网关在请求体超过模型硬上限时同样会直接拒绝或强制裁断。

---

## 三、 结论与最终决议

> [!CAUTION]
> **此议题彻底封存，不建议在客户端做任何针对自动压缩的拦截或打桩**：
> 1. 自动压缩是保护模型上下文不超出云端硬件窗口的核心机制；
> 2. 任何粗暴的本地拦截都会破坏 Cortex 引擎内部的状态机流转，引发不可预测的死锁或崩溃；
> 3. 已全量移除所有实验性环境变量与补丁，保持官方纯净出厂运行环境，会话上下文管理完全遵照官方原生机制。
