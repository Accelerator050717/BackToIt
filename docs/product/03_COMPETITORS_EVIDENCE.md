# 03 · 竞品与研究证据

研究日期：2026-10-22，America/Los_Angeles。UTC 检索/运行跨至 2026-10-23；这不表示未来数据。用途是制定可被推翻的 v0.2 假设，不是医疗建议或疗效声明。

本简报只回答一个产品问题：在不增加监控和内容消费的条件下，哪种主动入口最值得先检验，以帮助用户返回原任务？

**PM 结论：先比较 C「低刺激有限休息」与 D「无内容岔路口」；B「单轮互动」只作为有限的探索对照，A「知识卡」暂缓。** 保留 v0.1 Resume 作为独立基线，不能为了体验休息而强制增加一次中断。候选 45/90/180 秒均是设计参数；可用 90 秒作为原型起点，因为有时间体验结束与返回、又便于短时可用性测试，并非科学最优时长。正式默认方案由 [测试计划](08_MEASUREMENT_AND_TEST.md) 和 [发布门槛](09_RELEASE_GATES.md) 决定。

## 证据如何读

- **F：可核验事实**——论文设计/结果、固定 commit 的代码、此次自动化运行日志。
- **E：有边界的证据**——外部研究支持某种机制值得尝试，不等于证明 BackToIt 有效。
- **H：产品假设**——进入成本、主观负担、内容吸引力、返回意图等仍须真实试用。
- **开发者主张**与 **研究结果**分开。README、代码注释、下载量或近期提交都不能证明临床效果或用户收益。
- 没有进行朋友访谈、患者招募、诊断筛查或真实 A/B 测试；下述 N 均为论文样本，绝非本项目访谈人数。社区经验未作代表性采样，不能据此估计发生率。

研究日志、仓库元数据/树、隔离运行脚本与截图在 [research](evidence/research/README.md)。所有竞品代码只在研究目录；未复制进入正式扩展或原型产品逻辑。

## 一、与产品决定直接相关的研究

| ID / 来源与设计                                                                                                                                                                                                                                                                                     | 可以支持什么                                                                                                                 | 不能据此声称什么                                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **E1 · NIMH 成人 ADHD 官方说明**：[ADHD in Adults: 4 Things to Know](https://www.nimh.nih.gov/health/publications/adhd-what-you-need-to-know)；另有 [专家解释个体差异](https://www.nimh.nih.gov/news/media/2020/nimh-expert-dr-mary-rooney-discusses-managing-adhd)。官方公众资料，并非本产品试验。 | 成人可能遇到保持注意、组织、计划和启动困难；启动困难与持续困难不必同时出现。界面应支持外化下一步、减少操作，并允许不同偏好。 | “所有 ADHD 用户都缺多巴胺，因此必须游戏化”“不愿开始就是懒惰”，或以使用行为推断诊断。                                                    |
| **E2 · Albulescu 等，2022**：[PMID 36044424](https://pubmed.ncbi.nlm.nih.gov/36044424/)，[PLOS ONE 全文](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0272460)，DOI 10.1371/journal.pone.0272460。19 篇记录、22 个独立样本，N=2335。                                           | ≤10 分钟微休息总体与精力提升、疲劳降低相关，值得探索自主休息。详见下一节。                                                   | 90 秒最佳、小游戏一定优于无屏幕休息、提高学习成绩、改善成人 ADHD 症状。                                                                 |
| **E3 · Vermeir 等，2020**：[游戏化认知训练系统综述](https://games.jmir.org/2020/3/e18644)，DOI 10.2196/18644。49 项研究，9 项 RCT 进入 meta-analysis；多年龄/多类人群。                                                                                                                             | 游戏化训练更有动力/吸引力（g=0.72），同时更费力/困难；认知训练结果未显示相应显著增益。对 B 应同时测“愿意玩”和“能否退出”。    | 吸引力等于恢复效果；认知训练等于休息；这证明45–180秒小游戏帮助 ADHD 成人返回任务。样本/研究数、异质性、长期证据均有限。                 |
| **E4 · Leroy & Glomb，2018**：[Tasks Interrupted](https://pubsonline.informs.org/doi/10.1287/orsc.2017.1184)，DOI 10.1287/orsc.2017.1184；四项研究，当前读到出版者摘要。                                                                                                                            | 预先简短规划如何恢复，可缓解研究情境下的注意残留；支持保留用户写下的下一步这一设计方向。                                     | 本文重点包含“对插入任务的表现”，并非直接证明 BackToIt 的 Resume、ADHD 人群疗效或强制打断有益。未取得全文，不补造方法细节。              |
| **E5 · Grüning、Riedel、Lorenz-Spreen，2023**：[one sec 原论文](https://pmc.ncbi.nlm.nih.gov/articles/PMC9974409/)，[PubMed 36795756](https://pubmed.ncbi.nlm.nih.gov/36795756/)，DOI 10.1073/pnas.2213114120。6周现场持续用户 N=280；随机在线拆分实验 N=500。                                      | 在消费前给出放弃选项值得测试；在线实验中“可跳过”较强，只有反思文字未见有效。这为 D 提供间接依据。                            | 将论文57%数值当产品预测、将自主参与现场追踪当无偏RCT、推断真实学习或 ADHD 疗效。作者之一是 app 开发者；在线短视频实验与本产品场景不同。 |
| **E6 · Lyngs 等，2020**：[Facebook 自我控制界面实验作者稿](https://arxiv.org/abs/2001.04180v2)，DOI 10.1145/3313831.3376672。58名大学生，三组，六周；中间周引入干预。                                                                                                                               | 提醒目标、隐藏信息流都可能帮助保持任务，但提醒惹烦、隐藏内容引起错失感。应把自主性/被催促作为保护指标。                      | 证明 dh-focus 当前版本有效；自动监控 B 站必要；所有用户接受阻断；跨站、跨设备或 ADHD 特定效果。                                         |
| **E7 · Chen、Meng、Nie，2026**：[成人任务管理质性研究作者稿 v2](https://arxiv.org/abs/2603.17258v2)。22名 ADHD-identifying 成年人半结构访谈，另20人评议13种概念；作者标注 CSCW2026 accepted。                                                                                                       | 任务困难还与情绪、环境、社会支持相关；“更多计时器/更严格自控”不足以覆盖所有需求。可据此设计开放问题。                        | 研究样本代表全部成年人；概念偏好就是实际使用效果；本项目已访谈42人；证明 AI、游戏或休息能解决这些困难。正式出版状态未另作核验。         |
| **E8 · 中断干预综述，2021**：[PubMed 34273814](https://pubmed.ncbi.nlm.nih.gov/34273814/)，DOI 10.1016/j.apergo.2021.103506。33项实验室实验、49种干预。当前使用摘要。                                                                                                                               | 任务恢复提示等干预值得按具体任务检验，不能把所有中断看成相同问题。                                                           | 实验室准确率或恢复延迟改善等同真实学习、长期行为改变或成人 ADHD 结果。                                                                  |

阅读深度：E2/E3 为出版者全文；E1 为官方公众全文；E4/E6/E7/E8 当前结论限摘要/作者稿摘要。E5 直接 PMC 打开遇到浏览器检查，使用搜索工具返回的 PMC 正文（含方法、限制和利益披露），未绕过检查、未下载补充数据。检索路径与章节保存在 [sources.json](evidence/research/sources.json)。

### PMID 36044424 的必要边界

该研究纳入健康雇员或学生的实验/准实验微休息，**不是成人 ADHD 治疗试验**。精力效应 d=0.36、疲劳降低 d=0.35；整体表现 d=0.16、p=.116，未达统计显著。较低认知要求任务有表现改善信号；更长休息与更大表现效应相关。研究不足以充分区分具体休息活动，也没有确定通用最佳时长。不能从这些总体结果推出某个呼吸节奏、知识卡、游戏，或 45/90/180 秒的优劣。[PLOS ONE 方法、结果与限制](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0272460)

**本项目推断 H：** C 是低实施成本的探索对象；D 保留更低负担的对照。允许更长休息、提前退出与今天结束，不把短休息当强制处方。是否容易回来须观察真实试用，不从 d 值换算转化率。

## 二、五个指定仓库：版本与许可审计

使用已连接 GitHub 只读工具获取仓库元数据、默认分支 head、commit 作者/提交时间、递归树，再按 SHA 读取 README、许可和实际实现。未运行上游安装脚本。完整 SHA 与树保存在 research/repositories/\*.json；以下链接固定到当时 head。

| 仓库 / 默认分支                                                               | head 与 UTC 提交日期                                                                                                                         | 许可核验                                                                                                                                                        | 状态及本次运行范围                                                        |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| [NeuroFlow](https://github.com/aminehabchi/NeuroFlow) / main                  | [b6043dd8](https://github.com/aminehabchi/NeuroFlow/commit/b6043dd8b56f2a4a77ffbcf547fb7633ca6ebc68)，2025-07-28 16:47:22Z                   | [MIT LICENSE](https://github.com/aminehabchi/NeuroFlow/blob/b6043dd8b56f2a4a77ffbcf547fb7633ca6ebc68/LICENSE)                                                   | 未归档；小型原生 MV3。原始文件隔离加载并操作 popup 文档，范围见运行证据。 |
| [Resettle](https://github.com/cmarathe1/resettle-microbreak-extension) / main | [029a9089](https://github.com/cmarathe1/resettle-microbreak-extension/commit/029a9089c7a7fc6933ddaaf63fa90284ca135347)，2026-05-03 19:42:31Z | [MIT LICENSE](https://github.com/cmarathe1/resettle-microbreak-extension/blob/029a9089c7a7fc6933ddaaf63fa90284ca135347/LICENSE)                                 | 未归档；Plasmo/React18。仅原始 UI 组件 fixture；未跑上游构建和真实后台。  |
| [Focus Lock](https://github.com/wolph/focus-lock) / master                    | [360b1460](https://github.com/wolph/focus-lock/commit/360b14605b9edcffc6c5f508d60697d7db554ec4)，2026-10-22 18:22:14Z                        | [package.json 为 UNLICENSED](https://github.com/wolph/focus-lock/blob/360b14605b9edcffc6c5f508d60697d7db554ec4/package.json)；GitHub license=null，树无 LICENSE | 未归档，当前维护活跃的迹象；不能因此称稳定。只读源码，未安装。            |
| [Digital Habits Focus](https://github.com/digitalhabits/dh-focus) / main      | [3c80ec8b](https://github.com/digitalhabits/dh-focus/commit/3c80ec8b36daa3755a28d83839b040532f2a5050)，2026-10-22 10:05:23Z                  | GitHub license=null，递归树未见 LICENSE/COPYING；README 的 open source 自称不替代授权                                                                           | 未归档；Xcode及跨浏览器资源。只读源码，未安装或验证商店版本。             |
| [JumpyBrain](https://github.com/tanay9098/JumpyBrain) / production            | [6bf0e349](https://github.com/tanay9098/JumpyBrain/commit/6bf0e34992d6fb592bc4f70728ff614289912e99)，2026-09-28 08:41:09Z                    | [AGPL-3.0 LICENSE](https://github.com/tanay9098/JumpyBrain/blob/6bf0e34992d6fb592bc4f70728ff614289912e99/LICENSE)                                               | 未归档；前后端、扩展、移动部分。只读源码；未启动 OAuth/数据库/API。       |

**日期审计：** 五个 head 的 authorDate 与 committerDate 相同；没有晚于本次检索时间的异常。Focus Lock 与 dh-focus 是 LA 2026-10-22 当天提交，不能误标为未来，也不意味着审计覆盖未来修改。Git 提交日期是仓库元数据，可被作者设置；不是独立发布时间证明。

**采用边界：** MIT 项目在保留所需署名/许可后才有复用基础，本轮只作研究；UNLICENSED/缺许可不复制实现；AGPL 项目不移植进入本产品，若未来考虑需单独评估派生/分发义务。本文不是法律结论，当前方案根本不依赖复制竞品代码。

## 三、产品机制与维护成本比较

“成熟度”仅依据当前结构/依赖/变更和本次有限核验，不是安全认证、商店审核或生产稳定性结论。

| 产品       | 面向的情境/用户与核心机制                                                           | 返回现实任务                                                                                  | 游戏化/负担                                                          | 隐私、权限、运行成本                                                                                                                                                                    | 可借鉴 / 应避免                                                                                      |
| ---------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| NeuroFlow  | README 面向 ADHD；按当前 hostname 保存简单 Todo，All/Active/Completed，主题与徽章。 | 只找回网站对应任务文字；无用户保存的下一步/资源恢复或休息闭环。                               | 选择少；任务数 badge、完成反馈。README 的多巴胺措辞无试验证据。      | tabs+activeTab；localStorage；无服务端依赖。整份对象读写，存储异常仅日志，跨视图一致性须额外设计。低工程量也伴随恢复/可访问性缺口。                                                     | 借鉴就地记录、少选项；不复制“ADHD brains 都如此”的解释或把简单持久化称永不丢失。                     |
| Resettle   | 久坐知识工作场景；自适应提醒、呼吸/看远/姿势30/60/90秒脚本、正向计时。              | 休息结束处理会回原工作窗口等后台行为未实测；代码/UI没有用户任务下一步卡。                     | 连续天数、徽章、完成计数、恢复分数；默认仪表盘同时展开休息库和设置。 | alarms/storage/notifications/sidePanel；本地状态、历史上限300。需维护通知、工作时段、计时/暂停、窗口生命周期；比主动入口更复杂。                                                        | 借鉴有限脚本、提前结束；避开连续奖励、衰减惩罚和“恢复分数代表生理恢复”的暗示。                       |
| Focus Lock | 阻断型专注会话；三种严格程度、站点规则、时段/循环、访问额度。                       | 明确工作目标与 Back to work；这是最接近“明确返回目标”的模式，但不包含本产品的用户下一步语义。 | 严格模式、例外、积分额度/连续记录/统计增加决策与恢复逻辑。           | storage/alarms/tabs/favicon/webNavigation/offscreen/notifications/scripting；可选广域站点权限。默认本地、可选 Chrome Sync；需治理跨设备删除、覆盖层恢复和不支持页面。高工程成本。       | 借鉴目标显式可见、一键返回；避开 v0.2 阻断、自动监控、复杂额度体系。                                 |
| dh-focus   | 从网站页面移除信息流等元素；也有整页阻断/访问规则，面向希望保留网站实用部分的人。   | 减少干扰入口；没有本项目的快照/下一步/休息结束闭环。                                          | 非游戏核心；但规则、选择器和网站个性化设置多。                       | 当前共享 manifest 注入 all_urls，storage/tabs/activeTab/nativeMessaging；平台资源不同。网站 DOM 变动持续维护。存在有条件 usage ping 外联，不能直接沿用“绝无遥测”说法。                  | 借鉴环境层减负；不引入全站监控作为研究前提，不承诺跨站选择器永久有效。                               |
| JumpyBrain | 宽范围 ADHD 自称工具：任务、番茄钟、能量选择、推荐、正念、习惯/统计、集成。         | What Next 给任务建议，可标开始/完成；开始事件不是已经工作。选择另一任务也可能增加切换。       | 能量1–5、逾期提醒、统计等；功能面很宽，首次配置成本较高。            | Chrome 权限含 storage/alarms/notifications/declarativeNetRequest/tabs/identity，host含广域；后端MongoDB、OAuth、部分OpenAI调用；推荐日志含用户/任务相关字段。跨设备成本远高于本地扩展。 | 借鉴由用户表达状态；避免未验证“能量规律”成为自动处方、把规则排序称训练模型、把集成演示当已验证服务。 |

### 可追溯代码事实、主张与不确定性

**NeuroFlow。** [popup.js](https://github.com/aminehabchi/NeuroFlow/blob/b6043dd8b56f2a4a77ffbcf547fb7633ca6ebc68/js/popup.js) 查询 active tab 并取 hostname；[list.js](https://github.com/aminehabchi/NeuroFlow/blob/b6043dd8b56f2a4a77ffbcf547fb7633ca6ebc68/js/list.js) 读写 todo_urls，捕获错误后 console 日志，无交易/版本冲突处理。manifest 实际名称为 O，README 品牌为 NeuroFlow。README ADHD/多巴胺解释只作开发者主张；不存在本次核验到的产品临床证据。静态多窗口覆盖风险未注入测试，不当成已复现事故。

**Resettle。** [MicrobreakEngine](https://github.com/cmarathe1/resettle-microbreak-extension/blob/029a9089c7a7fc6933ddaaf63fa90284ca135347/src/engines/microbreak-engine.ts) 为固定脚本与时间点；[MotivationEngine](https://github.com/cmarathe1/resettle-microbreak-extension/blob/029a9089c7a7fc6933ddaaf63fa90284ca135347/src/engines/motivation-engine.ts) 的 recovery score 来自 streak/完成次数的截顶加权，非生理测量。count-up 优于 countdown、脚本可恢复生理状态等是 README 设计叙述，不是比较试验结论。[break-overlay.tsx](https://github.com/cmarathe1/resettle-microbreak-extension/blob/029a9089c7a7fc6933ddaaf63fa90284ca135347/src/tabs/break-overlay.tsx) 提供 Complete now/Skip；自然到时调用完成后关闭窗口。未实测后台通知/真实自动关闭，不应说全部功能正常。

**Focus Lock。** [ReturnToWorkButton](https://github.com/wolph/focus-lock/blob/360b14605b9edcffc6c5f508d60697d7db554ec4/src/popup/ReturnToWorkButton.tsx) 与 [overlay-work-target](https://github.com/wolph/focus-lock/blob/360b14605b9edcffc6c5f508d60697d7db554ec4/src/content/overlay-work-target.ts) 使目标/返回动作明确。[当前提交说明](https://github.com/wolph/focus-lock/commit/360b14605b9edcffc6c5f508d60697d7db554ec4) 仍列出 Hard 恢复验证失败时结束会话、其他同步设备可能重发已删数据等未决问题：这是维护者披露，未在本次复现。README 也明确不把微休息研究当治疗或25/5最佳时长证据；这种证据边界值得沿用。

**dh-focus。** [共享 manifest](https://github.com/digitalhabits/dh-focus/blob/3c80ec8b36daa3755a28d83839b040532f2a5050/Shared%20%28Extension%29/Resources/manifest.json)、[content.js](https://github.com/digitalhabits/dh-focus/blob/3c80ec8b36daa3755a28d83839b040532f2a5050/Shared%20%28Extension%29/Resources/content.js) 和 [background.js](https://github.com/digitalhabits/dh-focus/blob/3c80ec8b36daa3755a28d83839b040532f2a5050/Shared%20%28Extension%29/Resources/background.js) 显示隐藏/整页阻断实现。background 的 usage ping 检查 EULA 已接受，排除 Firefox 与开发安装，开关未显式 false 时允许；请求包含产品、平台和每月轮换随机键，credentials omit。未向该服务器实际请求，不能推断服务器保存行为。README 所引 Facebook 研究是 E6；它研究特定界面策略，不能作为此仓库当前构建的验证。

**JumpyBrain。** [priorityModel.js](https://github.com/tanay9098/JumpyBrain/blob/6bf0e34992d6fb592bc4f70728ff614289912e99/backend/ml/priorityModel.js) 是人工关键词分类、时间/紧急度/能量权重；晨间高峰等是代码假设，未核验对个体有效。[README](https://github.com/tanay9098/JumpyBrain/blob/6bf0e34992d6fb592bc4f70728ff614289912e99/README.md) 已明确当前 heuristic、训练暂停；扩展 manifest 描述仍用 smart ML。以实际代码和最新 README 为准。[WhatNext](https://github.com/tanay9098/JumpyBrain/blob/6bf0e34992d6fb592bc4f70728ff614289912e99/chrome-extension/src/components/WhatNext.jsx) 的 Start 写推荐事件；[recommendationLog](https://github.com/tanay9098/JumpyBrain/blob/6bf0e34992d6fb592bc4f70728ff614289912e99/backend/services/recommendationLog.js) 记录事件/任务快照；[aiService](https://github.com/tanay9098/JumpyBrain/blob/6bf0e34992d6fb592bc4f70728ff614289912e99/backend/services/aiService.js) 有 OpenAI 调用。未配置账号、API key或真任务验证。Android/iOS 功能需要对应客户端及系统权限，Chrome 扩展本身不能知道用户在刷手机。

## 四、实际界面体验证据

使用已安装的项目 Playwright/Chromium；只访问独立研究 profile/本地服务与合成任务。上游 MIT 源码以固定 SHA 下载，先审文件，未执行其 package scripts、未安装全局工具、未使用用户 Chrome profile。应用了 webapp-testing 工作流；项目已有 Node Playwright，故复用它，没有另装 Python 浏览器依赖。

| 观察                       | 验证方式与结果                                                                                                                                                                                                                                                     | 边界                                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| NeuroFlow 原始源码扩展页面 | 真正 load unpacked；Enter新增一项、重新加载仍保留、完成后 Active/Completed 筛选，3项断言通过，pageerror=0。[日志](evidence/research/neuroflow-runtime.json)                                                                               | popup.html 作为扩展标签页，因此 active hostname 是扩展ID。没有验证原生工具栏 popup、跨网站分组或长时稳定性。        |
| NeuroFlow 布局             | 400×620 文档下输入框中心命中 FOOTER，截图能看到遮挡；360×480另留截图。                                                                                                                                                                                             | 只结论于此视口/模式，不能扩写成所有原生 popup 都坏。toBeVisible 并不意味着控件未遮挡，这是需要视觉核验的例子。      |
| Resettle 原始组件 fixture  | 使用上游 sidepanel/overlay、CSS、资产及微休息引擎；360px下默认面板高度1407px，三类×三时长共9个按钮，设置展开；点击30s呼吸，展示有限脚本与提前完成/跳过。3项断言通过，pageerror=0。[日志](evidence/research/resettle-fixture-runtime.json) | React19代替上游React18，消息回复是显式合成状态。不是上游 Plasmo 构建，不证明 storage/alarms/通知/自动关窗真实可用。 |
| 返回闭环差异               | fixture完成后组件显示选择休息页；展示的组件没有原任务标题/下一步。                                                                                                                                                                                                 | 合成状态不能证明整个后台的窗口焦点行为。仅确认组件欠缺 BackToIt 所需的用户任务语义。                                |

截图：[NeuroFlow 620px](evidence/research/screenshots/neuroflow-active.png)、[NeuroFlow 480px](evidence/research/screenshots/neuroflow-480.png)、[Resettle 默认面板](evidence/research/screenshots/resettle-dashboard-360.png)、[休息选择](evidence/research/screenshots/resettle-picker-360.png)、[呼吸进行中](evidence/research/screenshots/resettle-breathing-360.png)。

**设计推断 H：** 窄侧栏不应默认展开所有活动与设置。进入休息的选择成本也要计入体验成本。有限休息结束后必须出现原任务名称+用户保存的下一步，避免在休息库中继续选择；“再休息一会儿”是显式、有界且不记失败的决定。

## 五、A/B/C/D 决策矩阵

以下成本为相对工程/运营估计，非工时测量、商业价值或试用结果。四方案均可本地预载、无需新增浏览权限；都应保留提前退出、无声/减少动画与同一返回卡。

| 方案                  | 可能的动机与机制 H                       | 认知负担/失控风险 H                                                      | 内容质量与维护                                              | 工程、隐私及可检验性                                                          | v0.2判断                                                |
| --------------------- | ---------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------- |
| **A 知识卡/Fun Fact** | 提供新鲜感，吸引主动从信息流切出         | 阅读是新认知任务；追索相关知识可能转成另一条内容链                       | 需来源、事实核对、双语、过期/版权管理；持续内容运营成本最高 | 静态1张实现便宜，长期内容昂贵；一张结束可测，但“觉得有趣”容易被误当收益       | 暂缓；暂无相较C/D改善返回的直接证据，不能无限“再一条”   |
| **B 单轮互动**        | 触觉/操作反馈，让有限休息更愿意被选择    | 规则学习、成就目标与重复尝试可能占用注意；E3只能提示吸引力与负担同时增加 | 确定性一轮、少量动作；无分数/输赢/稀有奖励；需键盘等价替代  | 中等：输入状态、结束边界、无障碍、动画；不用任务内容或网络。需测超时/再次进入 | 只作探索对照；若更有趣却延长停留，删或收紧              |
| **C 低刺激休息**      | 暂时脱离任务要求，允许看远/离开屏幕/安静 | 低，但呼吸指导并非人人舒适；屏幕动画也可能干扰。无需强制呼吸节奏         | 固定少量非医疗动作、文本/静态替代；维护低                   | 低至中：时间戳恢复、提前结束/延长；无需传感器，不能测是否真的休息             | 原型主候选；90秒只是便于体验的起点，可选45/180          |
| **D 无内容岔路口**    | 暂存分心想法，给出明确选择和原下一步     | 最低，但要求用户察觉并主动进入；对实际疲劳可能帮助不足                   | 几乎无内容运营；可复用 Parking/Resume语义                   | 最低；只存必要演示状态。E5间接支持选择机制，仍须与直接Resume比较              | 必须认真保留；若更容易回来，正式版本优先D或只优化Resume |

### 必须区分的三个问题

1. **“人愿不愿意打开”**只测可接受性。不能用打开更多、玩更久代替产品成功。
2. **“结束后选择返回吗”**是返回意图代理；点击接着做不证明已学习、已专注或完成任务。
3. **“是否值得新增功能”**必须比较直接离开后用 v0.1 Resume 的路径。若额外界面增加成本或打断好状态，可取消 Detour，集中改进 Resume。

本轮不引入常驻全站检测、B站播放状态推断、跨设备阻断、手机使用识别、随机奖励或医疗推荐。对真实浏览器和手机的能力边界沿用 [PRD](05_V02_PRD.md)；对证据推翻条件沿用 [决策记录](06_DECISIONS.md)。

建议先验证C/D与直接Resume的差异，B仅作有限比较，A暂缓。只有在自愿试用显示同一个候选更容易结束并回到原下一步、且保护指标可接受后，才投入最小正式工程；否则优先D或只优化Resume。
