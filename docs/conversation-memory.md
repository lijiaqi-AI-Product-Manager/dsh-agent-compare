# 主对话记忆与上下文 / Conversation memory and context

## 比较结果写回主对话

每次比较的关键事实，会作为这条对话自己的消息写入下一次请求，并保存在会话记录里。这些事实包括：两版的验收结果、你的选择（揭晓后改选时同时注明盲选）、采用或撤销后写入的文件、另存的分支。写入发生在 DSH 处理这次请求的那一步（`agent/pre-step`），排在你本次消息之前。这样模型回答“刚才比较的结果怎么样”或“在采用的版本上继续改”时，读到的都是记录里的事实。

- 已写入的事实按会话记录去重，不会重复出现；请求如果在提交前被取消，下一次请求会补上。
- 对话不在打开状态时什么也不做，你回到这条对话、发出下一条消息时再写入。
- 每次请求的系统提示里还附带最新一次比较的当前状态：需求、选择、采用状态、写入的文件和目标仓库。这份状态以记录为准，覆盖之前的旧说法。
- 卡片底部会显示「结果已写入主对话记忆」或「结果会在你下一条消息时写入主对话记忆」。
- 这些消息只给模型看，不会作为聊天气泡显示；会话的「轨迹」里可以查到。
- 候选会话和子 Agent 不会收到这些事实，也不能借此发起新的比较。

## 选择要带给两版的主对话内容

A|B 设置条里的「主对话上下文」决定两版候选能看到主对话里的哪些内容：

| 选项 | 两版看到的内容 |
|---|---|
| 不带 | 只有你写的需求 |
| 最近对话（默认，最近 3 轮） | 最近 1 / 3 / 6 / 10 轮里你的消息、回答、对话摘要和之前的比较结果 |
| 手动选择 | 你勾选的那几条消息 |

- 设置条会实时显示「两版都会看到同样的 N 条主对话内容，约 M 字」，展开后可以查看完整内容。
- 两版收到的内容完全相同，并且注明这只是背景、以需求为准；工具调用、推理过程和其他插件注入的内容都不会带入。
- 单条消息最多 2,000 字，合计最多 12,000 字；超过时保留最新的部分，并标注“已截取”。
- 带入的原文随比较记录一起保存，卡片底部可以展开核对。
- 内置示例使用独立的示例仓库，不带入主对话内容。
- 模型通过工具发起比较时，沿用这条对话保存的选项。“手动选择”因为没有勾选的消息，会改用最近对话。

## English

**Results back in the conversation.**
- Each comparison's key facts become the conversation's own messages in its next request, ahead of your message, and stay in the session log. The facts are: the shared check outcome, your pick (and the blind pick, if you changed it after the reveal), the files written or undone, and any saved branch.
- They are added at DSH's `agent/pre-step` and deduplicated against the log. A request cancelled before admission receives them on the next request.
- Every request's system prompt also carries the latest comparison's current state: task, pick, adoption state, written files and target repository.
- The card shows whether the result is already in the conversation's memory or will enter it with your next message.
- Candidate and delegated sessions never receive these facts.

**What both versions see.** Under **Main-conversation context** in the A|B settings:
- **None**: only the requirement.
- **Recent** (default, last 3 exchanges): your messages, replies, summaries and earlier comparison results from the last 1, 3, 6 or 10 exchanges.
- **Choose**: only the messages you tick.

The settings show exactly how many entries and characters both versions will receive, and the complete excerpt is available before sending. Both versions receive the identical excerpt, marked as background with the requirement taking precedence. Tools, reasoning and other injected context are excluded. Each message is limited to 2,000 characters and the excerpt to 12,000; the newest part is kept and marked as shortened.

The excerpt is stored with the comparison and can be reviewed on its card. Built-in examples include no conversation content. A comparison started by the model through its tool uses the saved setting, with **Choose** falling back to the recent exchanges.
