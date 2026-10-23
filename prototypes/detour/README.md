# BackToIt / 接着来：Detour 研究原型

这是 **v0.2 产品发现的独立网页原型**，不是已安装的浏览器扩展，也不是正式 v0.2。界面中的任务、资料与暂存内容均为明确标记的演示样例。它不读取 v0.1 IndexedDB、扩展 API 或真实任务，不产生使用事件统计。

## 实现前设计与状态方案（2026-10-22）

**要检验的问题：**主动绕开无限内容时，哪种轻量入口更容易让人看清原始下一步？C 留白休息、B 三步接线互动、D 无内容暂存是比较条件，不把互动有趣当作已证实有效。A 知识卡本轮不实现：需额外验证内容与维护成本，不能为了丰富原型而编造事实。

**视觉约束：**沿用 v0.1 paper `#f7fafc`、mist `#eaf1f7`、ink `#20364a`、secondary `#556b7b`、action `#235ea7`、line `#d7e2eb`；系统字体 Segoe UI / Microsoft YaHei，15–16 px 正文。唯一强强调是“接着做”和蓝色原始下一步区。休息以一道静态水平线表现“留一点空间”，不使用旋转环、呼吸节拍、奖励动画或远程素材。

```text
窄屏 320–480                宽屏 1024–1440
接着来   原型 / 语言         安静的说明栏 | 同一条主流程 | 留白
示例任务、原始下一步
[接着做]                    Resume 是主动作
歇一下 · 先放这里             Detour 是用户主动选择的次级入口
收起的研究设置               研究条件不伪装成正式功能
```

**修正默认设计倾向：**本地 UI 技能检索给出的绿/橙色、外部字体和营销 Hero 不符合既有工具语境，故不采用；采用其中可核验的可见焦点、低动画、语义按钮与 effect 清理规则。

**状态：**Resume → Choose → Rest(C/B) → Return → Resume；D 从 Choose → Parking → Return。Session 绑定显式示例 taskId、保存的 title/nextStep/revision；不依赖“当前任务”指针。Rest 的 startedAt/deadline 是事实来源，页面刷新定时器只重绘剩余时间。关闭、隐藏或重开后按时间戳计算到期，绝不自动启动新一轮。Return 不推断真实学习已经开始。

**边界：**任务缺失、归档、下一步为空、任务在另一窗口变化均有独立提示，不自动选择另一任务。原型仅存当前一次体验，不保留历史行为。45/90/180 秒都是研究候选，90 秒默认只是减少设置负担的假设。一轮最多显式延长一次，每个新段上限仍为180秒；需要更久可以离开原型，选择“今天先到这里”，不记为失败。

## 本地运行

使用项目已有且锁定的依赖；无需新增依赖或修改根目录脚本。从仓库根目录执行（首次克隆先安装依赖）：

```powershell
pnpm install --frozen-lockfile
node prototypes/detour/scripts/tool.mjs dev
```

访问 `http://127.0.0.1:4174`。只监听回环地址；在运行终端按 Ctrl+C 停止网页服务器。这与可独立安装的 v0.1 扩展不同。启动器从项目既有锁定依赖中解析 Vite、TypeScript、Vitest 与 Playwright；不会安装包或下载浏览器。

```powershell
node prototypes/detour/scripts/tool.mjs typecheck
node prototypes/detour/scripts/tool.mjs test
node prototypes/detour/scripts/tool.mjs build
node prototypes/detour/scripts/tool.mjs browser-test
node node_modules/eslint/bin/eslint.js prototypes/detour
```

构建输出仅在 `prototypes/detour/dist`。构建后可用 `node prototypes/detour/scripts/tool.mjs preview` 预览同一端口；浏览器测试会在端口空闲时启动该预览。测试及截图输出仅在 `artifacts/product-discovery/prototype`。不修改根 `.output`。这是网页原型测试，不可称为扩展 E2E。依赖项目已有可用的本机 Playwright Chromium；测试配置优先使用项目 `.playwright-browsers` 中对应版本，不访问真实用户浏览器资料。

已有dist时，也可以运行 `node prototypes/detour/scripts/serve-built.mjs`，只用Node内置模块启动同一回环端口，无需安装项目依赖。这适用于研究交付ZIP解压后的体验。端口被占用可在命令末尾追加4176等端口号；不会改动浏览器或系统服务。第三方运行库许可证保存在同目录`THIRD_PARTY_NOTICES.txt`。

许可证文本由根目录的`node scripts/package-product-discovery.mjs`从已安装的锁定依赖生成，随研究ZIP分发；作为生成文件被Git/自动CSS扫描忽略，防止法律文本被误识别为样式候选。源码仓库保留锁文件与生成脚本。

## 数据和研究限制

- 原型唯一 localStorage key：`backtoit:detour-research:v1`；Web Lock：`backtoit-detour-research`。跨页签共享演示状态，操作按锁内最新状态更新。样例编辑另校验任务版本；旧草稿不能覆盖已保存的新记录，界面保留本地草稿并解释冲突。此原型不会同步到另一设备。
- 默认没有声音；本轮不实现音效开关，也不偷偷请求音频权限。减少动画可手动选择并尊重系统设置。计时不逐秒向屏幕阅读器播报。
- 页面没有任何应用发起的外网请求、模型、分析或身份系统；开发服务器的本机 HMR 连接只服务开发。
- 所有样例均由实现者撰写，不是访谈原话。点击“接着做”只是回到示例恢复卡，不证明使用者已真正开始现实任务。
- 不知道手机、抖音或 B 站的状态，不监测页面、不屏蔽标签页。无后台提醒；浏览器关闭时不会响铃。
- 任何编辑只是原型样例。请勿输入真实私人任务；“重置原型样例”只改此 key。

## 使用的技能与实际应用

- `$CODEX_HOME/skills/frontend-design/SKILL.md`：已读取；实际应用为本节先设计/再复核，选择任务恢复特有的单一步骤层级、原有雾蓝色与静态接线图形。
- `$CODEX_HOME/skills/ui-ux-pro-max/SKILL.md`：已读取并运行本地 `scripts/search.py`：`"productivity calm interruption recovery" --design-system`、`"reduced motion timer announcements" --domain ux`、`"keyboard focus dialog" --domain ux`、`"state reducer event cleanup" --stack react`。采用焦点、motion与cleanup建议；不采用外部字体/营销结构。检索是设计指导，不是临床证据。
- `$CODEX_HOME/skills/webapp-testing/SKILL.md`：已读取并执行 `scripts/with_server.py --help`；实际运行 `python $CODEX_HOME/skills/webapp-testing/scripts/with_server.py --server "node prototypes/detour/scripts/tool.mjs preview" --port 4174 -- node prototypes/detour/scripts/recon.mjs`，先观察主标题与按钮，再做交互、截图与日志检查。第一次默认浏览器缓存启动失败，配置改为项目已有的有效 Chromium 后侦察与完整测试通过。项目已有 Node Playwright，因此使用同一已锁定浏览器测试运行器的独立配置，避免新增 Python 浏览器依赖。

## 已完成的工程验证（2026-10-22）

- 独立 TypeScript 严格检查与 ESLint 通过。构建通过，输出只在原型目录；Lucide 的 `use client` 指令有两条构建警告，本原型为纯浏览器客户端，无服务端组件。
- 18 项单元/存储测试通过：时间戳边界、提前退出、有限三步、显式单次延长、原始任务版本绑定、缺失/归档/无下一步、不替换未结束体验、跨窗口序列化、旧表单冲突、损坏数据保留、写入失败不报告成功。
- 8 项独立网页 Playwright 测试通过：主恢复路径、C/B/D、自然结束/关闭重开、跨窗口变更/归档/删除、真实双页签草稿冲突、中英切换、原生弹窗键盘与焦点归还、减少动画、样例重置和外部 key 不受影响。
- 宽度 320/360/420/480/1024/1440 与 420px 下 CSS 200% 放大均检查无横向溢出，已查看实际截图。计时恢复使用 Playwright 加速时钟，不能写成完整等待三分钟或关闭整个浏览器的人工试用。键盘检查不等于屏幕阅读器人工验收。
- 测试覆盖的主路径没有应用外网请求、未创建 IndexedDB 数据库，localStorage 仅有原型 key；未读取或写入正式扩展任务。

结果：`artifacts/product-discovery/prototype/unit-results.json`、`browser-results.json`、`browser-report/index.html`。截图位于同目录 `screenshots/`：`01-resume-420`、`03-quiet-rest-420`、`04-return-420`、`05-finite-interaction-420`、`09-direct-control-420`、`10-resume-320` 至 `10-resume-1440`、`11-english-compare-420`、`12-english-200-percent`、`13-conflict-draft-preserved-420`。

这些是工程和可操作性证据，没有真人试验、ADHD 疗效结论或真实任务重新开始率。正式产品决策与建议的真人试用见项目 `docs/product`。

GitHub 源码不含 dist；首次使用纯 Node 预览前须先 build。浏览器测试首次先运行 `pnpm browsers:install`。可在 [精选证据](../../docs/product/evidence/README.md) 查看脱敏的历史结果与截图。
