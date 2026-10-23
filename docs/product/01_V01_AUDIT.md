# v0.1 实际代码审计

审计日期：2026-10-22（America/Los_Angeles）。范围：`M:\adhd_project` 当前源码、测试定义、保留的 v0.1 报告与日志。结论用于 [v0.2 PRD](05_V02_PRD.md) 和 [发布门槛](09_RELEASE_GATES.md)，不是 Detour 已有效或已发布的证明。

**结论：v0.1 已有可复用的任务恢复闭环；Detour 应是绑定原任务的主动入口。它不需要另一套任务系统，也不能从当前页面、已过去的时间或一次“接着做”点击推断用户在学习。** 正式接入前最重要的约束是：保存现场会暂停任务并清空当前指针；恢复卡上的文字不一定已经提交；当前任务与用户正在查看的任务可以不同。

## 1. 证据与本轮操作边界

| 证据层       | 本次确实做了什么                                                                                                                                                                                                                                               | 能说明什么／不能说明什么                                                                                                                                                                                                    |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 源码审计     | 阅读 README、IMPLEMENTATION、PRODUCT、ARCHITECTURE、PRIVACY、HANDOFF、TEST_REPORT、manifest 配置、领域／存储／UI／浏览器／AI 源码与相关测试                                                                                                                    | 可核对实现、状态流和约束；不能替代运行、真人体验或医学效果                                                                                                                                                                  |
| 历史自动化   | 读取 `artifacts/verification.json`、`package-verification.json`、`logs/test.log`、`logs/test-e2e.log`                                                                                                                                                          | 保留证据记录 2026-10-02 的 105 项单元／组件／存储／契约测试和 6 条扩展 E2E 通过；不是本审计重新运行后的结果                                                                                                                 |
| 本审计执行   | 文件读取、文本搜索、文件 SHA-256、指引目录和 Git 状态检查                                                                                                                                                                                                      | 没有运行 build、verify、package；没有改 `.output`、生产源码或真实用户数据库                                                                                                                                                 |
| 本轮基线复查 | 主执行流程在独立副本运行；本审计随后读取 [baseline.json](evidence/baseline.json)、[新测试日志](evidence/baseline-logs/test.log)、[新 E2E 日志](evidence/baseline-logs/test-e2e.log) | 2026-10-22 本轮 lint／typecheck／test／build／E2E 退出码均为 0，新日志分别为 105 项和 6 条通过；79 项保护文件无变化，原 `.output`／ZIP 未改。数字与旧轮相同，但依据是本轮新日志；不是审计子任务亲自执行，也不是原型测试结果 |

审计文件清单、SHA-256 和历史命令元数据见 [source-evidence.json](evidence/audit/source-evidence.json)。当时目录没有 `.git`，`git status --short` 返回“not a git repository”，因此不存在可用于审计归属的提交／差异记录。项目内未找到 `AGENTS.md`、`.agents/skills/`、`.codex/`、`.claude/skills/`；会话中用户提供的工作指引仍适用。技能与工具的全轮评估见 [工作流记录](10_SKILLS_AND_WORKFLOW.md)。完整源码仍在本机；是否另有私有远程仓库，以本轮最终交付记录为准。

以下源码链接的行号对应审计时文件；SHA-256 用于识别随后是否变化。标签：**代码事实**＝源码可直接确认；**历史证据**＝旧报告／日志；**风险推断**＝尚未由本审计运行重现的条件性问题。

## 2. v0.1 能做什么，以及真正的状态语义

| 能力                 | 代码事实与证据位置                                                                                                                                                                                                                                             | 对 Detour 的约束                                                                                                       |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 任务恢复卡           | [TaskView.tsx:73](../../src/ui/TaskView.tsx#L73) 用 `task + draft.fields` 生成卡片；[120–170](../../src/ui/TaskView.tsx#L120) 展示进度、卡点、下一步和主要“接着做”按钮                                                                                         | 展示文字可能是本窗口尚未提交的草稿；进入休息前必须等待提交或明确说明未保存                                             |
| 下一步的来源         | [providers.ts:29–52](../../src/ai/providers.ts#L29) 优先保留用户 `nextStep`；缺失时给确定性本地建议，并返回 `isSuggestion`                                                                                                                                     | 结束卡不能把规则建议称为“你亲自保存的下一步”。空下一步必须保留缺失状态，不强制写下一步才准休息                         |
| 接着做               | [TaskView.tsx:68–72、147–166](../../src/ui/TaskView.tsx#L147)：先 `flush`，再 `repo.activateTask(task.id)`，再打开所选资料                                                                                                                                     | 接回的是明确任务，不是空白 Todo；点击只证明一次恢复意图，不证明真实学习开始                                            |
| 唯一当前任务         | [repository.ts:148–160](../../src/storage/repository.ts#L148) 原 active 暂停、目标 active、更新 meta.current；[163–188](../../src/storage/repository.ts#L163) 读取时校验指针和 active 一致                                                                     | 不新增 `detourCurrentTask` 之类的第二当前任务系统；正式返回前重新读取任务与当前状态                                    |
| 当前不等于正在查看   | [App.tsx:89、152–160、226–229](../../src/ui/App.tsx#L226) 有独立 `selectedId`；优先显示选中任务，其次当前任务，再次最近更新的 paused                                                                                                                           | 休息开始时应绑定用户确认的可见任务 ID。不能休息结束后只读全局 current，否则多窗口切换会接错任务                        |
| 保存现场／暂时不做   | [TaskView.tsx:79–99](../../src/ui/TaskView.tsx#L79) 先提交草稿，再 [repository.ts:245–263](../../src/storage/repository.ts#L245) 创建 checkpoint、更新字段、paused、清空该任务的当前指针                                                                       | “保存并暂停”不是单纯另存一个快照。若复用它进入休息，必须在暂停前记录返回 taskId；不能因 current 为 null 判定原任务消失 |
| 资料恢复             | [TaskView.tsx:34–39、55–67](../../src/ui/TaskView.tsx#L34) 默认首要／最近一个有 URL 资料；[adapter.ts:56–84](../../src/browser/adapter.ts#L56) 只复用可见且 URL 精确相同的标签，否则新建，不关闭其它标签                                                       | 结束后默认仍应少量恢复；休息不需要网页读取权限。不能把“返回任务”解释成恢复任意滚动位置、表单或桌面布局                 |
| Parking／先放这里    | [Parking.tsx:25–107](../../src/ui/Parking.tsx#L25) 折叠式输入、完成、编辑、删除、转任务；[repository.ts:438–484](../../src/storage/repository.ts#L438) 独立表，转换时创建并激活新任务、移除原暂存项                                                            | D 方案可复用“先留一句”，但不能自动把冲动转换为新任务，因为转换会切换当前任务                                           |
| 完成、归档、再次恢复 | [TaskView.tsx:106–112、157](../../src/ui/TaskView.tsx#L106) 显示状态且允许明确再次激活；[TaskManager.tsx:143–146](../../src/ui/TaskManager.tsx#L143) 可归档／取消归档                                                                                          | 休息期间归档／完成不能自动撤销；给出任务已变更的选择，不悄悄重开。删除则不能复活旧任务                                 |
| 搜索、备份与数据控制 | [TaskManager.tsx:35–59](../../src/ui/TaskManager.tsx#L35) 搜索任务和资料文字；[repository.ts:487–550](../../src/storage/repository.ts#L487) 导出和重映射导入；[SettingsView.tsx:463–472](../../src/ui/SettingsView.tsx#L463) 清空本地数据、session、副本和设置 | 原型不能导入真实备份、连接生产数据库或把演示任务变成真实内容                                                           |

### 草稿与快照不能混用

草稿是 Task 上正在更新的 `progress / blocker / nextStep`，不是独立草稿表。[useTaskDraft.ts:35–68](../../src/ui/useTaskDraft.ts#L35) 串行提交并循环追上新输入；[69–85](../../src/ui/useTaskDraft.ts#L69) 使用 300 ms 防抖，组件卸载只清除计时器。失败／冲突会保留当前窗口文本，提供重试、载入最新或保留本地输入（[88–104](../../src/ui/useTaskDraft.ts#L88)）。**浏览器关闭、窗口被销毁时，未完成提交的末尾字符没有持久性保证**，旧 HANDOFF 已说明这一边界。

Checkpoint 存当时的三段文字和资源 ID；没有任意网页副本、浏览位置或任务标题历史。历史展示按 `createdAt` 倒序，只读展示／删除，未提供“把某个历史 checkpoint 一键恢复为当前任务字段”的接口（[TaskView.tsx:348–390](../../src/ui/TaskView.tsx#L348)）。删除资源会清除旧快照中的引用（[repository.ts:357–365](../../src/storage/repository.ts#L357)）：文字现场保留，资源引用并非永远不变。

建议正式接入语义：先 `await flush()`，拿到已提交 Task；在独立休息状态中绑定其 ID、提交版本及用户 nextStep 的来源；结束前重新读取。字段／状态发生变化时显示最新记录并说明变化，用户明确选择后调用既有恢复语义。不要把进入休息写成任务 completed，不强制每次休息新增 checkpoint，不覆盖新的下一步。

## 3. 数据结构与兼容边界

[types.ts:1–48](../../src/domain/types.ts#L1) 和 [repository.ts:58–75](../../src/storage/repository.ts#L58) 定义六张表：

| 表／实体     | 已存字段与作用                                                                          | 不应误用                                           |
| ------------ | --------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Task         | 标题、active／paused／completed／archived、三段现场、首要资料、时间、revision、示例标记 | 没有注意力评分、真实学习时长或休息状态             |
| Resource     | taskId、标题、URL 或 null、摘录数组、备注、来源、时间、revision                         | 不是完整浏览历史，也不存用户没有主动保存的网页正文 |
| Checkpoint   | taskId、三段文字、resourceIds、createdAt                                                | 不是整个任务／标签页的可回滚副本                   |
| Parking      | text、done、时间                                                                        | 独立想法；无任务归属、提醒或 revision              |
| meta.current | 唯一 currentTaskId，可为 null                                                           | 暂停后为空，不适合作为休息返回目标的唯一标识       |
| undos        | 最近资料保存的撤销副本与版本                                                            | 不进入内容备份，不能代替 Detour 历史或事件日志     |

数据库名 `backtoit-v1`、Dexie version 1。备份 `schemaVersion: 1` 且严格校验未知字段和引用；不是随意加字段即可兼容的宽松格式（[schemas.ts:109 起](../../src/domain/schemas.ts#L109)）。限额包括 4 MiB 保存内容、5 MiB 导入、500 任务／5000 资源／5000 快照／2000 暂存项，标题 240、现场 6000、下一步 2000、单摘录 12000 字符（[schemas.ts:4–20](../../src/domain/schemas.ts#L4)）。

持久写入使用覆盖全部表的事务；多数写入还会读取并序列化全部内容检查配额（[repository.ts:90–116](../../src/storage/repository.ts#L90)）。这有利于完整性，但**不适合每秒把倒计时写回 Task**。本轮不迁移 schema；独立原型只保存自身演示状态。未来正式实验若需要休息状态，应另行定义存储、清理、版本与备份策略，经发布 Gate 审核。

## 4. UI、双语和可复用资产

| 资产       | 核对结果                                                                                                                                                                                                                                                                                                                    | 复用建议                                                                                                 |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 表面与布局 | 两入口共用 App，app 页面传 `fullPage`（[sidepanel/main.tsx:5](../../entrypoints/sidepanel/main.tsx#L5)、[app/main.tsx:5](../../entrypoints/app/main.tsx#L5)）。侧栏没有锁死 420 px，`.app-shell` 最大 100%，body 可收缩；全页面 ≥700 px 才切为网格（[styles.css:28–30、329–332、1212–1223](../../src/ui/styles.css#L1212)） | 360–420 px 是产品设计主范围，不是浏览器强制宽度。原型至少检查 320／360／420 px 和英文长文本              |
| 视觉 token | 本地 Segoe UI／微软雅黑，纸白 `#f7fafc`、雾蓝 `#eaf1f7`、深色 `#20364a`、行动蓝 `#235ea7`，正文根字号 15 px（[styles.css:3–23](../../src/ui/styles.css#L3)）                                                                                                                                                                | 独立原型可以明确复制少量 token 与克制的主次关系；不必导入整套生产 App                                    |
| 双语       | [i18n.tsx:4–20](../../src/ui/i18n.tsx#L4) 是 React context + 每处 `t(zh,en)`，数字／日期用 Intl；[App.tsx:53–57](../../src/ui/App.tsx#L53) 设置 lang 和标题；manifest 本地化另在 `_locales`                                                                                                                                 | 没有自动提取和缺文案检查；新增 Detour 状态、错误、按钮、计时播报需逐一覆盖中英文。不会翻译用户任务文字   |
| 模态与键盘 | [primitives.tsx:25–66](../../src/ui/primitives.tsx#L25) 用原生 dialog、aria-labelledby、Esc、返回原焦点；[styles.css:58–65](../../src/ui/styles.css#L58) 有清晰焦点环                                                                                                                                                       | 可复用交互模式。休息不应因计时结束抢焦点或把用户困在弹窗                                                 |
| 减少动画   | [styles.css:1482–1489](../../src/ui/styles.css#L1482) 响应 `prefers-reduced-motion`，停用 transition／animation                                                                                                                                                                                                             | 原型需要独立支持该偏好；不能只复用一张截图就声称无障碍通过                                               |
| 入口层级   | [TaskView.tsx:147–222](../../src/ui/TaskView.tsx#L147) “接着做”为主按钮，其下为暂时不做／换任务；Parking 保持独立折叠入口                                                                                                                                                                                                   | 未来 Detour 可作为这一组里的次级文字入口；不替换主按钮，不在状态良好时自动打开，不放大型娱乐卡压过下一步 |

**隔离注意：**生产 TaskView／App 导入 `repo`；仓库模块末尾创建实际数据库单例。原型直接复用这些组件会引入生产行为，因此本轮仅复用设计 token、文案语气和状态契约。WXT 的生产入口不应新增原型；原型不放入 `entrypoints/` 或 `public/`。当前 `tsconfig.json` 未排除 `prototypes/`，且 Tailwind 有源码扫描机制；新增 TypeScript 或工具类可能影响未来静态检查／样式候选，应通过独立配置或独立 HTML／JS／CSS 避免耦合。当前 `.output` 与安装包保持原样，不通过重新打包“顺便包含原型”。

## 5. 浏览器权限、MV3 和 AI 边界

**代码事实。**[wxt.config.ts:11–30](../../wxt.config.ts#L11) 为 v0.1、最低 Chrome 116，默认权限仅 storage／activeTab／scripting／contextMenus／sidePanel；可选主机仅 localhost、127.0.0.1；禁用隐身。没有 tabs／history／webRequest、全站主机权限、常驻 content script、alarms 或 notifications。快捷键为 Ctrl+Shift+Y 打开、Alt+Shift+S 保存（mac 的打开键为 Command+Shift+Y）。

工具栏／右键／命令的同步路径打开 side panel（[background.ts:90–102、123–159](../../src/browser/background.ts#L90)），正式入口不捕获就不读取正文。一次性顶层捕获排除输入、表单、contenteditable、designMode，检查当前授权与前后页面一致；iframe 选择拒绝（[capture.ts:26–65、99–127](../../src/browser/capture.ts#L26)、[background.ts:45](../../src/browser/background.ts#L45)）。这不具备知道用户正刷 B 站、看了多久或在手机上刷抖音的能力。

官方资料本轮复查（2026-10-22）：[activeTab 文档](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab) 指明临时授权来自 action、context menu、commands 等用户调用；[sidePanel 文档](https://developer.chrome.com/docs/extensions/reference/api/sidePanel) 指明 `open()` 从 Chrome 116 提供且需要用户交互。主动进入 Detour、展示已保存任务、显式返回不需要新增网页监控权限。不能把一次授权扩展成默认监视所有网站，也不能在计时到点时保证强行重新打开已关闭侧栏。

Worker 顶层注册监听器，任务状态从仓库重读（[entrypoints/background.ts:4–6](../../entrypoints/background.ts#L4)、[background.ts:46](../../src/browser/background.ts#L46)）。Chrome [生命周期文档](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) 明确后台可在不活跃后终止、全局变量会丢失。**计时必须以开始／结束时间戳为真相，UI 定时器只负责刷新显示**；本轮无后台提醒，不以常驻 worker 或扩大权限解决关闭／睡眠／重启。

待归属捕获与反馈使用 `storage.session`，只有单个 `pendingCapture` 值；UI 另有内存队列（[adapter.ts:32–49](../../src/browser/adapter.ts#L32)、[App.tsx:120–150](../../src/ui/App.tsx#L120)）。它不是跨浏览器重启的持久队列。Chrome [storage 文档](https://developer.chrome.com/docs/extensions/reference/api/storage) 区分会话与持久存储；休息恢复状态若只放 session，也不能承诺重启后保留。

删除全部通过共享 Web Lock 串行化最终捕获提交与清空，并以无内容 generation 清除跨窗口内存副本（[dataClear.ts:4–18](../../src/browser/dataClear.ts#L4)、[background.ts:42–83](../../src/browser/background.ts#L42)、[SettingsView.tsx:464–470](../../src/ui/SettingsView.tsx#L464)）。未来 Detour 的内存／持久快照同样应参与删除，不能在结束提示里复活旧任务标题。

AI 是独立可选能力，不应进入休息关键路径。[providers.ts:91–119](../../src/ai/providers.ts#L91) 只构造当前任务的有限字段、最多 8 项资源，移除完整链接；[196–215](../../src/ai/providers.ts#L196) 仅请求允许的三个 Ollama API，拒绝重定向并检查权限；[244–294](../../src/ai/providers.ts#L244) 处理并发、取消、超时、配置关闭；[296–355](../../src/ai/providers.ts#L296) 检查已安装本地模型元数据。只能说实现了限制和校验，不能由契约测试保证模型语义或本机服务绝不再联网。Detour 原型无需连接 Ollama。

## 6. 已有测试实际覆盖与未覆盖

下表为**历史证据与当前测试定义的对应关系**；相同基线在本轮独立副本的复查结果另见第 1 节的新日志，不应混淆两次运行。

| 范围               | 定义／历史证据                                                                                                                                     | 准确边界                                                                                                                            |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 105 项 Vitest      | [旧报告:7–27](../TEST_REPORT.md#L7)、[旧测试日志](evidence/historical-v01-test.log)；tests 下领域、仓库、草稿、恢复、删除、设置、捕获、AI 文件        | Chrome API／fetch 使用 mock，存储使用 fake-indexeddb；不能替代原生权限对话框和真实 Ollama                                           |
| 实际安装扩展闭环   | [extension.spec.ts:16–263](../../e2e/extension.spec.ts#L16)；[helpers.ts:18–45](../../e2e/helpers.ts#L18) 加载 `.output/chrome-mv3` 至独立 profile | 真实 worker／扩展 origin／IndexedDB／Chrome API，含重启、恢复、导入、离线；使用合成任务和回环网页                                   |
| 权限及编辑器拒绝   | [extension.spec.ts:265–317](../../e2e/extension.spec.ts#L265)                                                                                      | 有原生 action 授权、跨站失效、受限页、contenteditable／designMode；选区脚本在真实页执行，但测试驱动选区草稿入队，不等于系统右键操作 |
| 布局／键盘         | [extension.spec.ts:319–363](../../e2e/extension.spec.ts#L319)                                                                                      | 320／360／420／480 px 侧栏页面、1024／1440 px 全页、CSS zoom=2、Esc／焦点；不能声称 Chrome 菜单原生缩放或屏幕阅读器已验收           |
| 原生侧边栏容器     | [extension.spec.ts:365 起](../../e2e/extension.spec.ts#L365)、[helpers.ts:140–188](../../e2e/helpers.ts#L140)                                      | CDP 触发真实 extension action，再附加原生面板 WebContents；不同于普通页面模拟，也不是真人鼠标点击                                   |
| 数据删除与模型失败 | [extension.spec.ts:420、503 起](../../e2e/extension.spec.ts#L503)                                                                                  | 包含双窗口编辑器／session 清空；模型场景是启用但未授权的真实失败回退，没有真实推理                                                  |

旧日志的 6 条测试与当前文件中的 6 个顶层 `test()` 对应；报告保留了未验证项，并未把所有模拟都描述为真人测试。仍未验收：物理快捷键、系统右键、可选权限授权对话框、真实 Ollama、Chrome 116 实机、Edge、屏幕阅读器、真人 200% 原生缩放，以及真实用户恢复成本／负担／效果。手机、跨设备同步、网站拦截、后台分心检测、休息计时、提醒都未实现。

## 7. 单独记录的问题与技术风险

本轮不修改核心代码。优先级表示对后续接入的影响，不表示已运行确认的线上故障。

| ID／级别            | 问题、依据和可复核条件                                                                                                                                                                                                                  | 后续处理                                                                                             |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| A01／接入前必须处理 | **已确认状态契约冲突**：暂停后 current=null；正在查看的 selectedId 又可以不是 current。若 Detour 结束只按 current 恢复，会丢目标或接到别的窗口刚激活的任务。依据见上文 App 与 checkpoint 命令                                           | 原型显式绑定演示 taskId；正式接入要求跨窗口切换、暂停、归档、删除测试，不建第二当前任务系统          |
| A02／接入前必须处理 | **已确认数据来源差异**：卡片把未提交 draft 合入显示，本地规则会补缺失下一步。直接截图／复制卡片不能证明这些是用户已保存事实                                                                                                             | 进入时明确 flush 成功；缺失、冲突、失败分别有路径。结束展示来源，不自动写入规则建议                  |
| A03／现有已知边界   | 300 ms 防抖期间直接关闭 UI，尚未提交字符可能丢失；源码卸载时清 timer。不是本轮新发现的数据损坏，也没有承诺修复                                                                                                                          | 研究中观察是否构成实际负担；不能在录入未成功时显示“已保存现场”，Detour 入口复用 flush                |
| A04／P2 并发风险    | Parking 没有 revision；[repository.ts:455–463](../../src/storage/repository.ts#L455) 不校验编辑起始版本，读取提交时的记录再合并 patch。两窗口编辑同一个 text 时后写覆盖先写，无任务草稿式冲突提示。**静态风险推断，未在本审计交互重现** | 若 D 方案扩大 Parking 使用，增加两个窗口文字编辑的专门验收；不得宣称所有实体都已有 revision 冲突保护 |
| A05／P2 暂存边界    | `pendingCapture` 是单值，第二次未归属捕获可以覆盖 session 中第一次；仅已打开 UI 的内存队列可能保留两次。**由存储形状推得，未做本轮时序重现**                                                                                            | 不把 session 称为可靠多项队列；休息状态用独立 key，不能占用这个槽；正式评估是否需要队列能力          |
| A06／P3 文档不精确  | [ARCHITECTURE.md:35](../ARCHITECTURE.md#L35) 写“用户内容仅在 IndexedDB”，但 [adapter.ts:37–38](../../src/browser/adapter.ts#L37) 的 session 待归属捕获也含标题／URL／摘录；PRIVACY 的描述较准确                                         | 后续把旧架构句子限定为已持久保存的任务内容。本轮只记录，不覆盖旧文档                                 |
| A07／工程隔离风险   | 生产入口和原型若共享 App／repo 或公共构建扫描，可能连接正式数据库或污染后续构建范围                                                                                                                                                     | 原型独立服务和演示存储；发布 Gate 检查生产入口、manifest、包内容和 v1 备份兼容；禁止原型数据迁入生产 |

本审计没有新运行重现出需要立即修改生产数据层的 P0／P1 故障；这不是“没有 bug”的保证。当前最确定的产品风险是**把休息做得更有吸引力，却没有更清晰、更轻的原任务返回**。可复用 Resume、Parking 和保存契约，先用隔离原型比较无内容入口与有终点休息；是否投入正式扩展实现，交由 [研究与测量](08_MEASUREMENT_AND_TEST.md) 和 [发布门槛](09_RELEASE_GATES.md) 判断。

## 8. 本轮最终构建隔离核验补充

2026-10-22（America/Los_Angeles）补充：根代理完成 [isolation.json](evidence/isolation.json) 所记录的核验（UTC 完成时间 2026-10-23T01:54:49.635Z），本审计者已读取报告并核对隔离输出目录含 15 个文件。带本轮研究及原型文件的原项目执行 lint、typecheck 均通过；使用原 WXT 配置、仅将 outDir 指向独立研究目录重建也通过。报告确认 **79 个受保护原文件未变、15 个构建文件与原生产基线逐字节一致、没有新增构建路径或原型标记，原 .output 与 ZIP 未改动**。与前述 [独立副本基线](evidence/baseline.json) 分开记录，本段没有把历史测试当成新运行。

因此，A07 的构建扫描污染风险在本次所核验状态已有否定证据；后续改动仍须保留隔离检查。此结果不代表 Detour 已接入正式扩展，不补足真人研究、真实服务或人工无障碍验收，也不改变其余审计边界。
