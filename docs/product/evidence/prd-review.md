# 独立 PRD 复核

时间：2026-10-23T01:50:55.265Z。这是对当时文档的独立检查；问题已先发给主执行流程，尚未在本报告中宣称修复。本审阅者未编写被审的 00、02、04–11 产品文档，也未修改这些文件或 UI。

方法：[SuperElectron prd-review 固定版本](https://github.com/SuperElectron/prd-template/blob/8eeca0c61eed0e1fd22c65a7226562332a03bed7/.claude/skills/prd-review/SKILL.md)；实际读取远程 Skill，并重新计算 Git blob SHA，确认为 `c02611bb3c95d5065a97f67fdafa945069a7d3b8`。许可由本轮主流程核查为 MIT。22 项逐一评分，属于文档质量判断。

## 适配说明

- User-required numbered docs/product filenames override the skill's dated prds naming convention; no renaming requested.
- Draft is accurate: no PR or release approval is being claimed. Ready for Review is a document-quality verdict, not Gate1/Gate2 approval.
- No invented baseline is required. A clearly specified future baseline protocol is valid for this research plan, while current real-user evidence remains missing by design.
- The user's requested full PRD is assessed with its linked appendices; no arbitrary two-page cutoff.
- Findings are sent to parent for edits; this reviewer changes only its review artifacts and does not offer/perform unsolicited product or UI edits.

## 清单评分

| 项 | 检查 | 结论 | 文档证据 |
| --- | --- | --- | --- |
| P1 | 问题可独立理解 | **PASS** | 05:9 / 00:9–17 clearly separate the friend's reported situation from the proposed opportunity. |
| P2 | 故事可转化为实现 | **PASS** | 05:15–18 maps four concrete jobs to F01–F18 and the interaction appendix. |
| P3 | 功能验收可判定 | **NEEDS WORK** | 05:55 can be implemented as a racy read then unconditional activateTask; see F05. |
| P4 | 指标含目标及观测窗口 | **NEEDS WORK** | Numerical targets and 30/60-second windows exist, but denominator, candidate attribution and untimed-variant guardrail conflict; see F01–F03. |
| P5 | 保护指标存在 | **PASS** | 08:23–26 tracks overstay, re-entry, interference and refusal; F03 refines the undefined application to untimed variants. |
| P6 | 范围排除真实明确 | **PASS** | 05:69–73 excludes production integration, schemas, new permissions, phone monitoring, AI and content operations. |
| P7 | 风险及未知被保留 | **PASS** | 05:75 and 04:H1–H7 include non-adoption, burden, migration uncertainty, timing and bias. |
| P8 | 依赖被点名 | **PASS** | 05:73 and 09:11–24 name v0.1, local runtime, voluntary participants and future transaction/integration work. |
| P9 | 状态与阶段相符 | **PASS** | 05:3 says Draft; 09 says Gate1 not passed and Gate2 not started. |
| P10 | 路径遵守本任务约定 | **PASS** | The user explicitly requires docs/product/05_V02_PRD.md and related fixed filenames; the skill convention is superseded. |
| P11 | 长度与拆分合理 | **PASS** | The main PRD links evidence, measurement and detailed interaction appendices instead of repeating all research. |
| D1 | 决策约束清楚 | **PASS** | 06:3–7 separates adopted prototype scope from proposed production scope and weak user evidence. |
| D2 | 选择表述确定 | **PASS** | 06:D01–D10 states concrete adopted scope choices, each in a concise row. |
| D3 | 存在真实替代 | **PASS** | 06:13–22 and 39–41 compare actual options, including Resume only and D only. |
| D4 | 舍弃理由具体 | **PASS** | 06 alternatives identify monitoring permissions, content maintenance, cognitive burden and data copies rather than generic cost claims. |
| D5 | 后果包含代价 | **PASS** | 06:26–37 names unknowns, confidence and overturning conditions. |
| R1 | 单一主研究问题显式 | **NEEDS WORK** | 02 begins with evidence vocabulary but does not state one primary decision question; see F06. |
| R2 | 主张有出处 | **PASS** | 02:11–18 tags stakeholder report, source evidence, code facts and team hypotheses separately; this pass did not re-run the external literature audit. |
| R3 | 来源和计划有日期 | **PASS** | 02:3/13–14 and 10 source versions distinguish 2022/2020 studies from the 2026 research plan. |
| R4 | 信心区分明确 | **PASS** | 02 evidence matrix and 04 H1–H7 do not equate code certainty with user value. |
| R5 | 证据缺口可见 | **PASS** | 02:3, 05:63, 08:3 state zero actual participants; phone detection and clinical efficacy are not claimed. |
| R6 | 研究简报有行动建议 | **NEEDS WORK** | 02:67 ends with analysis instructions and a link, while the recommendation only appears in other documents; see F06. |

## 按影响排序的问题与具体修改

### F01 · P1 · 只选 Resume 的拒绝者会被 Gate 分母排除

范围：`docs/product/08_MEASUREMENT_AND_TEST.md:7,15`。Before participant data is used for Gate1。

原文：“不因没开Detour被排除 / N包含所有已同意记录、完成基线且开始至少一个方案”

问题：These sentences conflict. Requiring a Detour start excludes the refusal behavior the research is supposed to preserve.

建议替换：Gate1 的分母 N 包含所有同意记录、完成直接 Resume 基线且没有阻断性工程故障的参与者，包括只选直接 Resume、拒绝所有 Detour 方案、中途退出或跳题者。未观察到的候选结果保留在 N 中、单列缺失，不计入成功分子；同时报告所有同意者、工程故障、退出和拒绝人数。

### F02 · P2 · 描述性回答率与放行率未分开，候选归属不明确

范围：`docs/product/08_MEASUREMENT_AND_TEST.md:20,59`。Before Gate1 scoring。

原文：“分母：完成该方案体验且自愿回答的人 / 全部N中至少80%…至少60%…”

问题：The table uses a responder denominator while the gate uses all N. A person can find B useful yet be counted toward a C/D release unless evidence is attributed to a named candidate.

建议替换：对每个候选 s∈{C,D} 单独报告：描述性清晰度 c_s / 实际愿答人数，以及放行清晰度 c_s / N。c_s 只计在 s 的返回卡出现后 30 秒内无提示正确指出原任务下一步的人；v_s 只计能说明 s 相对直接 Resume 的具体价值的人。候选 s 需同时满足 c_s/N≥80% 与 v_s/N≥60%；缺失不计成功，不能以 B 的回答放行 C/D，也不合并各方案最有利答案。

### F03 · P2 · 无时长的 D／Resume 被放进两倍时长保护指标

范围：`docs/product/08_MEASUREMENT_AND_TEST.md:13,23`。Before research observations are scored。

原文：“D/直接Resume没有休息时长 / t0后超过2×所选时长…分母：有效开始会话”

问题：Two times a nonexistent selected duration is undefined and can accidentally be treated as zero.

建议替换：两倍时长停留保护仅用于 C/B：分子为首个 t0 后超过 2×初始所选时长、且仍可观察地停在休息相关界面的会话，分母为 C/B 有效开始会话。D 和直接 Resume 分别报告可观察的操作耗时、关闭、求助和返回情况，不计算两倍时长比例。

### F04 · P2 · 强制轮流体验不能观测主动入口选择

范围：`docs/product/08_MEASUREMENT_AND_TEST.md:43–45`。Before H1 is treated as observed adoption。

原文：“按分配的C或B进入 / 体验另一个方案 / 展示…D对照”

问题：The script can test usability but gives no unprompted choice before participants are instructed to enter each variant, contrary to H1's proposed free-choice falsification.

建议替换：基线后增加一次不提示具体按钮的选择：『假设此刻你想暂时离开，你会怎么做？可以使用界面，也可以什么都不做。』记录直接 Resume、离开、C/B/D 或拒绝；此选择不影响 N。随后征得愿意比较的参与者同意，再按平衡顺序体验 C/B/D，标记为主持人安排。该观察只代表演示情境下选择，不宣称真实场景采纳率。

### F05 · P1 · 先检查再激活的两步合同存在跨窗口竞态

范围：`docs/product/05_V02_PRD.md:38,55`。Gate2 production design; does not require v0.1 changes this round。

原文：“先检查归属、status和revision，再执行v0.1的activateTask(taskId)”

问题：repository.ts:241–242 only takes id. Its transaction activates the latest task without comparing an expected revision/status. Another window can archive or edit after the pre-read and still be reopened.

建议替换：正式 resumeDetour 必须在同一仓库事务内核验绑定 taskId、预期 revision/status 并激活；冲突、归档或删除时返回明确结果，不打开资料、不自动重开。新增受检仓库命令或等价事务 API 后，才复用显式所选 openResources。Gate2 增加『预检查完成后、激活提交前另一窗口修改／归档／删除』回归。原型只模拟此语义，本轮不修改核心。

### F06 · P3 · 简报缺少开头主问题与结尾建议

范围：`docs/product/02_USER_RESEARCH.md:3–7,67`。Non-blocking clarity fix。

原文：“分析时分别归纳…四类动机；保留负例、退出和不愿使用的理由…”

问题：The reader can infer the question from other documents, but this independent brief does not state what single product decision the research should answer or what to do now.

建议替换：开头增加：『本轮主问题：相对直接 Resume，用户主动选择的 C/D 能否减少找回下一步的负担，同时不增加难以结束或被催促的体验？』结尾增加：『当前建议仅推进知情同意的小样本比较；C/D 与直接 Resume 同场保留，B 只用于负担对照。若无具体增益或拒绝入口占多数，优先 Resume/D，停止完整休息路线。』

## 特别核对

- 全 N 的 80%／60%门槛已经写入，但 N 的入口条件仍排除一类拒绝者；不能只看百分数字面而判通过。
- D 的 t0 已明确，且文档没有把 D 伪装成等剂量休息；需要修正保护指标适用范围。
- 真人样本明确为 0；5–8 人、阈值和未来试用均为计划，没有编造 A/B 结果。
- 当前任务与显式返回 taskId 已区分；保存现场会 paused/current=null 的语义被保留；未来返回的原子核验还需补明。
- 00 的定位、04 的否定路径、06 的替代选择、07 的假设分数、09 的阶段门槛、10 的方法来源边界总体一致。原型“已实现”是否全部成立由单独工程证据验证，本轮未用文案代替代码检查。

## 结论

**Needs Revision**。先修 F01–F04 的研究执行口径和 F05 的未来仓库合同；F06 为文档清晰度小修。修订完成可再做一轮定点复核；这不会使 Gate1／Gate2 自动通过。修复由主执行流程完成，本审阅者只维护本报告与 JSON。

