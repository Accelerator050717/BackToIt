# BackToIt v0.2 产品发现交付索引

日期：2026-10-22（America/Los_Angeles）。本轮是研究、企划和独立网页原型，正式扩展仍为v0.1。

**PM建议：先验证主动、有限、绑定原下一步的C低刺激休息与D无内容返回；B只用于比较，A知识卡暂缓。如果D或原有Resume更合适，就缩减功能，避免把休息做成新的内容停留场。**

## 直接体验

从克隆目录的 PowerShell 中运行（先 `pnpm install --frozen-lockfile`）：

```powershell
node prototypes/detour/scripts/tool.mjs dev
```

打开 [本地原型](http://127.0.0.1:4174/)。若同端口的研究预览已经运行，直接访问即可；Ctrl+C关闭相应运行终端。原型只监听回环地址、使用演示样例，网页服务器需保持运行。正式v0.1安装方式仍见项目根README。

原型中可以比较C留白休息、B三步接线、D暂存一句后直返；调整45/90/180秒、提前结束、自然结束、明确延长一次、今天先放下。研究设置提供无任务/归档/无下一步、样例编辑、少动画及重置；支持中英文和键盘。不要输入真实敏感任务。

## 文档阅读顺序

| 文件                                          | 内容                                                 |
| --------------------------------------------- | ---------------------------------------------------- |
| [00 产品一页纸](00_PRODUCT_VISION.md)         | 定位、用户情境、价值及非目标                         |
| [01 v0.1审计](01_V01_AUDIT.md)                | 真实代码、复用合同、缺口及新旧验证区别               |
| [02 用户研究](02_USER_RESEARCH.md)            | Fact/Evidence/Hypothesis、旅程、12个开放题、同意原则 |
| [03 竞品与证据](03_COMPETITORS_EVIDENCE.md)   | 5个开源项目、8组研究、许可、读取与运行范围           |
| [04 机会地图](04_OPPORTUNITY_MAP.md)          | 结果→机会→方案→可否定假设                            |
| [05 v0.2 PRD](05_V02_PRD.md)                  | 18项要求、故事、验收、原子恢复合同、范围             |
| [06 决策](06_DECISIONS.md)                    | 10项选择、替代、后果和推翻条件                       |
| [07 路线图](07_ROADMAP.md)                    | 主观ICE排序、研究/正式/移动阶段                      |
| [08 测量及试用包](08_MEASUREMENT_AND_TEST.md) | 分子分母/退出定义、10–15分钟脚本、空白观察表         |
| [09 发布关卡](09_RELEASE_GATES.md)            | Gate0/1/2、停止、数据兼容和回滚                      |
| [10 技能工作流](10_SKILLS_AND_WORKFLOW.md)    | 看到、读过、实际应用的区别与来源                     |
| [11 交互规格](11_INTERACTION_SPEC.md)         | 状态机、布局、双语、焦点和边界                       |
| [12 交付验收](12_DELIVERY_AND_VALIDATION.md)  | 实际检查、截图、修复及未验范围                       |
| [第三方说明](THIRD_PARTY_NOTICES.md)          | MIT方法改编、微软CC BY4.0归属及代码边界              |

工程运行和范围详见 [原型README](../../prototypes/detour/README.md)。原型的网页测试不能当作正式扩展E2E；真人访谈人数当前为0，Gate1/2未通过。

完整本机研究交付包：`artifacts/product-discovery/backtoit-v0.2-product-discovery.zip`（仅本机留存，不在 Git 中）。其中包含原型dist，可在解压目录直接运行 `node prototypes/detour/scripts/serve-built.mjs`，无需安装项目依赖；它不是扩展安装包。

## 证据和接续入口

`artifacts/product-discovery/` 内的 `baseline.json`、`isolation.json`、`prototype/`、`independent-review/`、`research/` 和PRD复核报告分别保存真实结果。生成的工作区、profile和第三方研究下载保留在本机并被忽略，不混入源码上传；精选合成证据由研究交付包单独提供。

下一步先按08做自愿小样本比较；只给同一个胜出候选判定门槛，不拼接不同方案的最好结果。没有真实研究前，不把可运行原型当作功能已经值得上线。

GitHub 阅读请使用 [精选证据索引](evidence/README.md)；从干净克隆启动与验证见 [开发者说明](../DEVELOPMENT.md)。
