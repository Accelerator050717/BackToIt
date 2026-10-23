# v0.2b 工程验收、技能应用与剩余未知

日期：2026-10-23（America/Los_Angeles）。基线提交 `776e2486f9ec2404f13e41cd04d70614e02d0763`；本轮仅独立研究分支 `research/adhd-first-v02b`，不合并main。真人参与者0，Gate1未过，真实时段阶段未开始。测试结果不能证明现实启动收益或ADHD疗效。

## 已执行与证据种类

| 范围 | 实际执行 | 结果与边界 |
| --- | --- | --- |
| v0.1 独立副本 | pnpm lint / typecheck / test / build / test:e2e | 本轮重新运行：105项单元/组件/存储/契约与6条真实加载扩展E2E通过；副本15产物与原输出逐字节相同 |
| v0.2b 模型与存储 | node prototypes/adhd-first/scripts/tool.mjs test | 46项通过：25模型、21存储。时间、目标版本、双击、锁排队、失败不写、损坏保留、归档/删除/重建与重置代际等 |
| 新原型静态与构建 | tool.mjs typecheck；node node_modules/eslint/bin/eslint.js prototypes/adhd-first；tool.mjs build | 严格TS、ESLint、独立Vite构建通过；输出只在原型dist，不进入WXT |
| 新原型实际浏览器 | node prototypes/adhd-first/scripts/tool.mjs browser-test | 14项通过；五路径、英语主要流程、并发冲突、失败及可访问交互。完整结果见[浏览器JSON](evidence/browser-results.json) |
| 真实DOM先观察后操作 | with_server.py --help；使用helper启动4178后执行原型scripts/recon.mjs | 实际读取标题/按钮、截图、操作一片小岛；pageerror=0、外联=0、IndexedDB为空，仅新原型key |
| 视口与视觉 | 浏览器截图与横向溢出断言 | 320/360/420/480/1024/1440；420下CSS zoom 200%，30张合成状态截图。不是物理设备或浏览器原生缩放验收 |
| 文档审阅 | 逐项来源/假设/分母/能力边界核对 | 17项通过，首轮3项澄清均修正。01/03/05/06/索引为跨作者审阅；02/04为原作者自审，非全套外部独立认证 |
| 最终原目录隔离 | 原配置只覆盖输出目录，lint/typecheck/build与SHA比较 | 全部通过：99个保护文件未变、15个重建产物逐字节一致、原型标记为0；原.output/ZIP及旧Detour未改，见[隔离JSON](evidence/v01-isolation.json) |

原始新日志保留于本机 `artifacts/adhd-first`；[精选证据](evidence/README.md)是脱敏副本。旧v0.2的18/8与2026-10-22结果是历史，不计入本轮46/14。v0.1本轮105/6是重新实际执行，不是复述旧数字。

## 覆盖了什么

- Tiny Start保留用户原文；本地规则只给一个可改建议；不计时和自愿30秒分开。建议不覆盖任务、点击/到期不标完成；没有下一步时不编任务细节。
- Tiny Spark固定三片，重复同一步指令只生效一次；第三片、时间上限或提前结束都回原任务。最多一次显式延长变成安静45秒，没有下一局推荐。
- Quiet按startedAt/deadline恢复，关闭页面不靠常驻interval继续“真相”。系统时间拨回到开始之前时安全停止并说明；时间前跳到期回卡，不自动打开任务。
- Parking可跳过，一句最多240字、最多12条，删除校验所见内容以免并发时删错。它是研究样例，不写正式Parking、不另建任务。
- taskId/revision绑定和同锁内最新状态检查；变更/归档/删除/换任务使旧帮助失效，显式查看新版/重开才恢复。删除同时清快照和派生小动作。损坏重置有新generation，之后再选同名样例也不能碰撞旧窗口身份。
- 原生dialog的Enter/Escape、初始焦点/返回触发器、阶段标题焦点、语义按钮/标签与Space/Enter拼接均实际检查。系统及手动reduced motion的computed style为零过渡/无动画；计时不逐秒播报。
- 全部浏览器用例监听外网HTTP请求和未捕获异常，均为0；专门用例确认IndexedDB为空，并保留注入的旧Detour/其他存储键。应用无fetch、CDN、远程字体、音频、模型、通知、analytics或chrome API。

## 首次问题、原因与修复

| 真实发现 | 修复及受影响复验 |
| --- | --- |
| 首轮存储16项中2项失败：非法phase/path能保存；删除重建样例复用旧revision | 新原型schema拒绝不可能组合，版本单调；后补损坏reset的generation隔离。21存储与全46项通过；未改生产 |
| 删除派生小动作回归首次1失败：清空tinyAction后仍留attempt，与严格schema冲突 | 删除/归档/变更目标时帮助转到限制返回卡；删除清快照和派生文字。回归通过，保留首轮JSON |
| 新增拨表保护后旧并发测试1失败：人为11ms操作却把会话起点设1000ms | 改测试为1011/1012/1013ms；不是取消拨表保护。增加独立拨表回归，46项通过 |
| 4178被首次recon helper遗留的Node占用 | 核对命令后只停止本轮自建服务；旧4174未动。测试服务使用strictPort，避免误测其他页面 |
| 首次独立Playwright服务路径重复，MODULE_NOT_FOUND | 在新配置明确webServer.cwd为仓库根。后续真正执行用例，未用已有服务器掩盖配置问题 |
| 首次真正14项浏览器用例为8通过/6失败：受控textarea的getByLabel匹配含原值；check即时断言早于异步提交 | 改语义textbox选择器；click后等待最终checked。未改src迎合断言；修正后14项通过，新模型补强后又复验 |
| v0.1副本命令全通过但CSS首次68KB，原包30KB | 仅给ignored QA副本初始化空Git边界，修复Tailwind内容扫描；重跑build和6条E2E，15文件字节一致。原源码/配置/包未动 |
| 最终原目录重建多出576字节CSS，来自新浏览器测试对象键被自动内容扫描 | 只重命名新测试的对象键，保留断言含义；相关浏览器用例定向1项通过，原完整14项结果保留。最终root lint/typecheck/build与15产物字节比对均通过；精确键名与首轮记录只在被忽略的证据中保存 |
| 文档首轮3项澄清 | 新旧Gate编号映射、S顺序/自述符号区分、Tiny Start真实动作可早于返回点击；逐项复核已解决 |

Vite保留两条Lucide `use client` 警告，本原型为纯浏览器客户端；v0.1原有共享chunk超过500KB警告仍在，未为消警告修改生产打包。浏览器计时主要使用Playwright加速时钟，不冒充真人等满30/45/90/180秒或真实专注。

## 实际使用的技能与工具

本轮先检查项目指引与会话清单；仓库中无新增本地技能目录。下表路径用 `$CODEX_HOME/skills` 表示，不依赖某位开发者的个人目录。没有安装全局工具、插件或新依赖。

| 候选/来源 | 看到、读取或实际应用 | 对本轮实际产物的作用与取舍 |
| --- | --- | --- |
| frontend-design，本地快照，Apache-2.0 | 已读SKILL和LICENSE并应用 | 原型README先写token/布局/复核；保留任务原文与一个主动作，趣味只集中小岛，失败文案可操作。不是套营销模板 |
| ui-ux-pro-max，本地快照；目录未找到独立LICENSE | 已读并实际运行2次search.py | `task reentry playful accessible --design-system`、`dragging movements keyboard alternative --domain ux`。采用单指替代拖动/键盘/焦点；拒绝医疗字体、外部字体链接、绿橙品牌与视频营销结构。输出未整段复制，不分发技能代码 |
| webapp-testing，本地快照，Apache-2.0 | 已读SKILL/LICENSE、实际运行helper --help与一次with_server.py侦察；套件适配现有Node Playwright | networkidle后观察真实DOM再操作，截图及pageerror/network检查。没有另装Python Playwright；14项测试使用根锁定运行器 |
| humanizer v3.0.0，MIT | 已读、用于02/04最终文字审校，无脚本执行 | 删宣传化与重复语句，保留证据、来源、未知和精确分母；不能把工具审校称成真人验证 |
| 既有SuperElectron/Microsoft PM方法 | 看到并沿用项目已有问题/需求/验收/证据结构；本轮未重新读取或执行远程Skill | 自主完成新七文档与研究协议；旧许可/署名保留在[原第三方说明](../THIRD_PARTY_NOTICES.md)，不冒称安装或运行成功 |
| agent-browser/Figma/云模型/服务插件 | 在可用清单评估，未为本轮加载或运行 | 已有本地测试足够；没有Figma交付、外部账号或模型需求，不为数量添加权限/远程服务 |
| GitHub与开源资料 | 实际读NeuroFlow/Resettle元数据、固定版本LICENSE及关键源码片段 | [复查记录](evidence/opensource-recheck.json)。仅比较机制，未复制竞品代码；旧隔离运行结果保持历史身份 |

四个本地SKILL快照SHA256依序为：`d91970639e9f5c37682ac7ab60094d35f1c7c1f38d731bd56396563aee10c1d3`、`ea087c341bfb5b23195c7302027268ede86da802554c18a5c4896a6017b439f9`、`51b7349e77ec63b7744a6f63647e7566a0b4d2e301121cc10e8c2113af6556a2`、`e8269e236bed06ed0fe4824c274112e54950b0cb46b0bafe5e1576ef7c9f93d5`。版本是本地观察快照，不宣称上游最新。

## 截图与可复现入口

[Tiny Start](evidence/screenshots/02-tiny-start-editable-420.png)、[三片完成后的同任务返回](evidence/screenshots/06-spark-finished-return-420.png)、[旧草稿冲突](evidence/screenshots/13-stale-editor-draft-retained-420.png)、[写入失败保留输入](evidence/screenshots/14-storage-failure-keeps-draft-420.png)、[320首页](evidence/screenshots/16-home-320.png)、[1440展开选择](evidence/screenshots/17-needs-1440.png)、[200% CSS布局](evidence/screenshots/18-needs-css-200-percent-420.png)均来自真实运行的合成原型。不是设计稿，也不是参与者照片。

从干净克隆按[原型README](../../../prototypes/adhd-first/README.md)安装根锁定依赖、构建并测试。新浏览器测试会自行启动4178服务，因此应先关闭同端口开发服务器；不访问真实Chrome资料。历史隔离harness和完整日志在原工作区ignored目录，克隆中复验v0.1请按[开发者说明](../../DEVELOPMENT.md)使用标准命令，不依赖本机安装包。

## 仍未验证与发布边界

没有真人访谈、自然采纳、第一现实动作、长期使用或医学效果；没有物理手机、触觉硬件、真实读屏、浏览器原生200%缩放、Edge、真实Ollama、生产MV3集成/数据迁移验证。自动键盘与CSS布局检查不能替代这些验收。真实任务绑定的价值也不能由合成卡片field probe证明。

可交付的是用于受控研究的原型、正式文档与可审阅代码。私有仓库保持 [Accelerator050717/BackToIt](https://github.com/Accelerator050717/BackToIt)，审阅分支 [research/adhd-first-v02b](https://github.com/Accelerator050717/BackToIt/tree/research/adhd-first-v02b)。推送前检查敏感模式、个人路径与Git清单，只提交文档/源码/测试/精选合成证据；不推profile、真实任务、依赖、环境配置、ZIP或dist。main与正式扩展不合并。
