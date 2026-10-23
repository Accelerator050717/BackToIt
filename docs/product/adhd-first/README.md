# BackToIt v0.2b ADHD-first：产品与体验入口

日期：2026-10-23（America/Los_Angeles）。本轮把 ADHD 相关的启动、记忆、刺激需要、切换、时间边界与负担落实为可体验和可否决的机制。不是给旧工具换标签。正式 v0.1 与旧 Detour 保持不变。

**PM 建议：优先验证 Tiny Start 的「保存的下一步 → 可修改的一个最小动作 → 自愿尝试」；认真保留三片小岛的有限趣味候选，同时允许研究删掉它。当前参与者为0，不能判断它是否比直接 Resume 更有价值。**

## 直接体验

在仓库根目录执行，首次克隆先 `pnpm install --frozen-lockfile`：

```powershell
node prototypes/adhd-first/scripts/tool.mjs dev
```

访问 [新版研究原型](http://127.0.0.1:4178/)，先体验首页 → 我卡住了 → 开始不了。旧 [Detour 对照](../../../prototypes/detour/README.md) 仍用4174，新旧存储互不改写。启动、构建、浏览器测试与逐步 Demo 见 [新版原型 README](../../../prototypes/adhd-first/README.md)。服务只在本机运行，不是公共发布。

五种可比较的路径：直接 Resume；Tiny Start 可编辑建议、默认不计时/自愿30秒；Tiny Spark 可预测三片拼接、立即结束；Quiet Pause 45/90/180秒；Park & Return 可空一句暂存。没有诊断、账号、模型或真实任务导入。研究设置可关闭趣味、减少动画、换样例或触发边界。

## 阅读与判断

| 文档                                              | 帮助审阅什么                                                       |
| ------------------------------------------------- | ------------------------------------------------------------------ |
| [01 定位](01_POSITIONING.md)                      | 三套中英表达、ADHD-first如何落在操作、Tiimo/Goblin对比             |
| [02 执行功能地图](02_EXECUTIVE_FUNCTION_MAP.md)   | 六类困难×机制×风险×可测结果，来源与不适用范围                      |
| [03 正式 PRD](03_PRD_V02B.md)                     | P0/P1/P2、任务/版本合同、正反例与未来集成边界                      |
| [04 两阶段研究](04_EXPERIMENT_AND_INTERVIEW.md)   | 同意话术、10–20分钟探索、真实时段复盘、分母/退出、空白表和否决规则 |
| [05 决策与取舍](05_DECISIONS_AND_TRADEOFFS.md)    | 趣味保留/删除、手机三路线、隐私及工程取舍                          |
| [06 发布建议](06_RELEASE_RECOMMENDATION.md)       | 当前能交付什么、不能上线什么、下一阶段如何收窄                     |
| [07 测试与技能报告](07_TEST_AND_SKILLS_REPORT.md) | 实际命令、首次问题与修复、截图、隔离证据及未验范围                 |
| [证据索引](evidence/README.md)                    | 来源元数据、合成截图与精选工程结果                                 |

旧 [v0.2 文档](../README.md) 与 2026-10-22 的 C/D 优先判断保留为历史对照；本轮转向 Tiny Start 来自新目标和问题建模，没有新真人结果支持排名。工程测试不能证明 ADHD 疗效、现实启动收益或长期使用价值。
