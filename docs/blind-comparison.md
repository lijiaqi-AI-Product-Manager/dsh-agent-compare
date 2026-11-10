# 盲选与揭晓 / Blind comparison

## 中文

比较可以是**盲选**（默认），也可以是**公开对比**。两者都可以选 2–4 版。

**盲选：**
- 开始时，所选的风格（或模型）会被随机分配到 A–D，设置里的顺序不会透露哪一版是哪种。
- 选择前，各版只显示这些信息：真实页面、运行阶段、耗时、共同验收结果、可否采用，以及执行边界。
- 风格与模型、用量、改动规模、文件列表、工具名称与目标、候选自己的说明和详细日志，都在揭晓后才显示。
- 完整记录始终保存在本地。

**公开对比：**
- 按设置的顺序对应 A–D，风格、模型、说明、改动规模和用量一开始就显示，没有揭晓这一步。
- 适合已经清楚想比什么，只需要并排看效果的时候。

**3–4 版时：**
- 可以先「排除」不考虑的版本，剩下的会并排放大，被排除的版本在恢复之前不能选。
- 在卡片里按 1–4 键专注某一版，按 0 回到全部。
- 排除只影响这张卡片的显示，不改动记录。

**其他规则：**
- 安装失败时仍会显示失败分类、错误代码和恢复建议，也可以对原候选重新验收。
- 所有版本都无法体验时，可以选「都不采用并揭晓」查看详情；这不会清理保留的代码。
- 选择之后再重新验收，已经揭晓的信息不会重新隐藏。
- 选择后可以说明理由：点几个固定理由（布局、配色与质感、交互手感、文案、功能更全、更稳、更简洁、更快更轻），或补一句不超过 120 字的话。理由随选择保存，改选时清空；主对话的下一条消息会带上它们，比较记录里也会显示「因为……」。
- 揭晓后、尚未采用或另存分支之前，可以「改选」另一版已完成的结果，例如盲选的那一版没有通过共同验收。记录会同时保留最初的盲选结果，揭晓说明会注明“揭晓后改选”。已经有采用记录的比较不能改选。
- 没有可用结果、都没选，或选中的一版没有通过验收时，可以在同一张卡片里点「再比较一次」：用同一条需求在本对话中开始新的比较，还可以先选更长的每版上限（上次因时长截断时，默认建议下一档）。原来的比较和记录保持不变；示例比较会新建一个示例仓库。

应用自身的文字和行为也可能透露来源。盲选能减少标签造成的先入为主，但不保证匿名，也不能把单次偏好推成模型或风格的排名。

## English

A comparison is **blind** (the default) or **open**. Either runs 2–4 versions.

**Blind:**
- At the start, the chosen styles (or models) are shuffled across A–D, so the order in the settings does not tell you which is which.
- Before the pick, each version shows only:
  - its actual app, stage and elapsed time;
  - its shared check outcomes;
  - whether it can be adopted;
  - its execution boundaries.
- Styles and models, usage, change scale, file lists, detailed tool activity, candidate prose and raw logs appear after the reveal.
- Full local records are kept.

**Open:**
- Versions follow the chosen order as A–D. Styles, models, prose, change scale and usage are shown from the start, and there is no reveal.
- Use it when you already know what you are comparing and just want to see the versions side by side.

**With three or four versions:**
- Set aside the versions you have ruled out. The rest move up side by side, and a set-aside version cannot be picked until it is restored.
- Press 1–4 in the card to focus a version, and 0 to show them all.
- Setting a version aside changes only this card's view, not the record.

**Other rules:**
- Installation failures keep their category, error code and recovery advice, and the original candidate can be reverified.
- When no app runs, choosing to adopt none reveals the details without cleaning retained code.
- Later verification retries keep previously revealed information visible.
- After the pick you can say why it won: tap fixed reasons (layout, look and colour, feel in use, wording, more complete, fewer problems, simpler, faster and lighter) or add a note of up to 120 characters. Reasons are kept with the choice and cleared if the pick changes; the next message in the main conversation carries them, and the comparison history shows them.
- After the reveal and before any adoption or branch, you can **pick another finished version instead**, for example when the blind pick failed the shared checks. The record keeps the original blind pick, and the reveal summary marks the change. A comparison with an adoption record cannot be re-picked.
- When no result is usable, nothing was picked, or the pick failed the checks, **Compare again** starts a new comparison of the same requirement in the same conversation. You can pick a longer time limit first; after a timeout, the next longer limit is suggested. The earlier comparison and its record stay unchanged; an example comparison creates a fresh example repository.

An app's own content and behaviour may reveal its source. Blind comparison reduces label bias; it does not guarantee anonymity or turn one preference into a ranking of models or styles.
