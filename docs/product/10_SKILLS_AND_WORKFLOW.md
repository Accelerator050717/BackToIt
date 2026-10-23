# 本轮实际使用的技能与工具

检索/审查日期：2026-10-22。先查项目指引、会话技能清单，再看公开目录和候选仓库；没有安装任何第三方Skill、运行远程安装脚本或配置付费服务。项目没有自身AGENTS.md或发现到的`.agents/skills`、`.codex`、`.claude/skills`指引，沿用用户在会话提供的工作约束。

“看到”仅指目录/README发现；“读过”指已读具体Skill/关键引用；“应用”必须指向本轮产物或实际命令。Skill是工作方法，MCP/CLI是工具，两者不混称。外部文字始终作为参考资料。

| 候选 / 来源及版本                                                                                                                                     | 审查深度 / 本轮状态                                                                                                      | 采用、放弃与实际落点                                                                                                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 本地 `frontend-design/SKILL.md`                                                                                                                       | 已读、应用；没有给定版本号，按当前文件                                                                                   | 原型README先做设计方案/反模板复核；沿用任务恢复层级、雾蓝token、系统字体、静态接线。没有套营销首页                                                                                                                                               |
| 本地 `ui-ux-pro-max/SKILL.md`                                                                                                                         | 已读、实际运行本地search.py                                                                                              | productivity calm interruption recovery设计系统；reduced motion timer announcements与keyboard focus dialog的UX查询；state reducer event cleanup的React查询。实际影响按钮/焦点、减少动画、计时播报和effect清理；拒绝不合本项目的绿橙/远程字体建议 |
| 本地 `webapp-testing/SKILL.md`                                                                                                                        | 已读、应用；已执行`with_server.py --help`                                                                                | 原型与竞品先观察DOM、再操作、截图和检查日志。使用项目锁定Node Playwright运行器，避免另装Python浏览器；这是对现有栈的适配，未声称运行了Python测试套件                                                                                             |
| 本地 `find-skills/SKILL.md`                                                                                                                           | 已读，应用发现/核查流程                                                                                                  | 查[skills.sh目录](https://skills.sh/)、现有清单和指定PM仓库；安装量不当质量保证。已有合适方法，未运行`npx skills add`或全局安装                                                                                                                  |
| SuperElectron/prd-template，commit `8eeca0c61eed0e1fd22c65a7226562332a03bed7`，2026-08-26；MIT                                                        | 已读README、LICENSE、prd-authoring、decision-records、prd-review及对应模板/写作引用；编写/决策已应用，复核记录见交付报告 | [05_PRD](05_V02_PRD.md)六段主结构、[06决策](06_DECISIONS.md)真实替代/后果、独立复核pass。按用户要求使用本项目文件名，不安装Claude、MCP或Git工作流；没有为了凑指标编基线                                                                          |
| Microsoft hve-core requirements-author，Skill元数据spec1.1/2026-09-18；product-discovery引用blob `3089f886a18830c619b36a969d0af8ec4a68d448`；CC BY4.0 | 已读相关Skill首部及完整product-discovery引用；仅应用其情境/旅程和证据来源方法                                            | [02研究](02_USER_RESEARCH.md)区分转述、代码事实、外部证据及未验证假设；不加载BRD全栈，不把“需要访谈”改写成已经访谈。源文件的交互式提问建议由用户的自主执行要求替代                                                                               |
| deanpeters/Product-Manager-Skills，README自述v0.84，head `cfcb697f14b8891d8b3ec43c16c3547df3e70e13`，2026-10-16；CC BY-NC-SA4.0                       | 已读README、OST Skill关键流程及LICENSE；**仅评估，未应用该Skill**                                                        | 路径清楚但NC-SA复用约束与本轮无需完整facilitation依赖；未安装或复制其模板。机会地图是本项目自己写的结果/问题/候选/实验结构，框架只按原作者名称参考                                                                                               |
| 其他设计/研究/工程技能                                                                                                                                | 只看到当前清单                                                                                                           | 没有Figma写入、文档排版、后端、模型或新权限任务，不为数量加载整套技能                                                                                                                                                                            |

本地Skill路径基于 `$CODEX_HOME/skills/`，不是项目依赖。原型README保留可移植路径、查询与实际取舍。远程Skill的blob SHA、状态摘要在 `artifacts/product-discovery/skills-reviewed.json`，署名与许可证见[第三方说明](THIRD_PARTY_NOTICES.md)。

## 工具与真实结果

- GitHub连接器：实际读取候选仓库元数据、源码/树、许可证、commit，以及当前连接身份。只读认证成功不等于有创建私库能力；未创建/推送仓库。本机无`gh`，工具清单也无create_repository，后续路径见[发布关卡](09_RELEASE_GATES.md)。
- 网络检索：主来源为官方研究/出版者与作者仓库；PubMed有429、PMC直开有浏览器检查，改用合法可达的出版者全文/搜索正文。每篇读取深度与限制在[03证据](03_COMPETITORS_EVIDENCE.md)，不把摘要描述成读完全文。
- 竞品代码审查和隔离运行：NeuroFlow真实扩展文档、Resettle组件fixture；两种证据不同，详见research/README与截图。不执行上游安装脚本，不给用户真实profile加载竞品。
- 本地工程：以既有依赖创建v0.1副本运行lint/typecheck/105tests/build/6E2E；原型拥有独立配置、存储及浏览器测试。构建污染与原包指纹需单独核查，详见[交付验收](12_DELIVERY_AND_VALIDATION.md)。

## 过程选择与剩余风险

最少方法链为：问题及证据来源 → A/B/C/D发散 → 可测试PRD/决策 → 原型 → 独立复核。没有把方法的通用数字或目录流行度当成本产品证据。技能不能补出缺失的受访者；真实价值、真人无障碍和正式扩展集成仍需下一轮。

## 2026-10-23 v0.2b 补充

本页上文为旧轮历史记录。新版实际发现/读取/应用的技能与测试分别记录在 [ADHD-first 测试及技能报告](adhd-first/07_TEST_AND_SKILLS_REPORT.md)：frontend-design、ui-ux-pro-max、webapp-testing 与 humanizer。沿用旧PM文档结构不冒充重新运行远程Skill；新原型使用现有锁定依赖，不安装服务或扩大权限。GitHub已存在私有仓库，本轮使用独立审阅分支，不能沿用旧工具盘点的“尚未上传”推断当前状态。
