# 本轮交付、修复与验证记录

日期：2026-10-22（America/Los_Angeles）；UTC日志部分跨到10月23日。工程环境Node24.14.1、当前pnpm11.25.0，原packageManager声明11.19.0及锁文件未改。以下均为本轮实际执行，旧10月2日报告单独保留。

## 发现与产品结论

已核对5个开源项目的固定源码/许可及8组外部研究，完成产品一页纸、用户问题与旅程、机会图、18项需求PRD、10项决策、路线图、试用与发布门槛。研究不能证明本产品改善ADHD，不能用外部研究的效果百分比预测BackToIt。

建议先验证C低刺激有限休息与D无内容返回，保留直接Resume对照；B三步互动只作有限比较，A知识卡暂缓。若没有比直接Resume多出的价值，优先D或只改善Resume。所有新文档见[索引](README.md)。

## v0.1基线与保护证据

运行 `node scripts/product-discovery-baseline.mjs`。它复制明确选中的v0.1源码和原配置到全新研究工作区，链接本机既有依赖及配套Chromium；生成输出、测试数据库和profile都在副本。新结果见 `artifacts/product-discovery/baseline.json`：

| 原命令           | 本轮结果                   | 日志                          |
| ---------------- | -------------------------- | ----------------------------- |
| `pnpm lint`      | exit0                      | `baseline-logs/lint.log`      |
| `pnpm typecheck` | strict检查exit0            | `baseline-logs/typecheck.log` |
| `pnpm test`      | 105项通过，无跳过          | `baseline-logs/test.log`      |
| `pnpm build`     | 15文件正式构建通过         | `baseline-logs/build.log`     |
| `pnpm test:e2e`  | 6条实际扩展E2E通过，无跳过 | `baseline-logs/test-e2e.log`  |

日志路径均相对 `artifacts/product-discovery/`。这是本轮重新运行的扩展证据，不是复述旧结果；真实模型、系统右键/物理快捷键等旧未验边界仍保留，不因本轮复验自动升级。

79个受保护文件包含原核心源码、测试、配置/锁文件、15个正式产物和原ZIP。`v01-before-sha256.json`与最终`isolation.json`显示受保护路径变化为0；未修改schema、权限、核心功能、原`.output/chrome-mv3`或`artifacts/backtoit-0.1.0-chrome.zip`。

## 带原型后的隔离复验

运行 `node scripts/product-discovery-check.mjs`：实际根目录执行lint/typecheck，并以 `pnpm build --config artifacts/product-discovery/wxt-isolation.config.ts` 引入原WXT配置、**仅覆盖outDir**，输出至 `artifacts/product-discovery/production-build-check/chrome-mv3`。

最终三阶段均exit0。15个文件与原生产包逐字节一致；没有新增文件或原型存储key/样式标记。`isolation.json`、`isolation-logs/`和独立输出目录可核对。未为通过检查而重写原生产包。

实际失败和修复也保留：

- 第一轮副本隔离发现ESLint推荐配置的目录注册副作用，导致根解析目录歧义；只修改原型自己的ESLint配置，使用等价公开配置并明确原型目录。根配置不变。
- 自动CSS扫描曾把新研究脚本的普通词及生成的第三方声明误识别为工具类，产生多余选择器和连带资源hash变化。调整新脚本命名，将生成研究档案/下载/副本和生成许可证用各自的`.gitignore`排除扫描和源码上传；许可证仍完整随研究ZIP分发。没有修改生产CSS。
- 第二次副本检查位于被忽略的研究目录内，继承父级忽略规则，导致扫描范围不足。这是验证方法缺陷，不把它当作产品变化。最终改为真实项目根目录构建、只改输出位置，证明当前实际来源集合可重建同一包。
- 初始结果和日志在`isolation-attempt-1*`、`isolation-attempt-2*`、`isolation-attempt-3*`；最终以`isolation.json`为准。以后新增研究文本/脚本仍应重做隔离检查，不将自动扫描边界当作永久保证。

## 原型与网页验证

独立源码在 `prototypes/detour/`，构建在其`dist/`；不导入生产App/仓库，不使用chrome API或生产IndexedDB。真实实现C留白、B三步接线、D一句暂存；有限45/90/180秒、提前/自然结束、显式延长一次、今天先放下、绑定保存版本、空/归档/无下一步、跨窗口更新及旧表单冲突、重开后时间戳恢复、中英、键盘和少动画。

| 命令 / 检查                                                | 实际结果                                                                                             |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `node prototypes/detour/scripts/tool.mjs typecheck`        | 独立strict TypeScript通过                                                                            |
| `node node_modules/eslint/bin/eslint.js prototypes/detour` | 独立lint通过；根lint也通过                                                                           |
| `node prototypes/detour/scripts/tool.mjs test`             | 18项单元/存储通过                                                                                    |
| `node prototypes/detour/scripts/tool.mjs build`            | 独立dist构建通过                                                                                     |
| `node prototypes/detour/scripts/tool.mjs browser-test`     | 8条真实网页Playwright测试通过，无跳过、失败或重试后通过项                                            |
| 宽度与布局                                                 | 320/360/420/480、1024/1440、CSS200%无横向溢出；查看关键运行截图                                      |
| 根执行者独立检查                                           | 加载实际DOM后操作，真实墙钟等待45秒自然结束（未更改浏览器时钟），明确Resume后核对原任务ID/下一步一致 |
| 原型数据/网络                                              | 检查路径中仅自身localStorage key；IndexedDB列表为空；应用外网请求和pageerror均为0                    |
| 无依赖静态预览                                             | Node内置HTTP预览的HTML、JS、CSS均200；不存在文件404，见`static-server-check.json`                    |

结果文件：`prototype/unit-results.json`、`prototype/browser-results.json`、`prototype/browser-report/index.html`；19张原型截图在`prototype/screenshots/`。另有根执行者4张截图和`independent-review/recon.json`，记录45秒实测耗时及断言。原型套件的边界计时另用Playwright加速时钟，不能描述成每次真实等待三分钟或完全重启浏览器。

截图示例：[主恢复卡](evidence/prototype/screenshots/01-resume-420.png)、[C留白](evidence/prototype/screenshots/03-quiet-rest-420.png)、[B单轮互动](evidence/prototype/screenshots/05-finite-interaction-420.png)、[D返回](evidence/prototype/screenshots/09-direct-control-420.png)、[1440宽屏](evidence/prototype/screenshots/10-resume-1440.png)、[旧表单冲突](evidence/prototype/screenshots/13-conflict-draft-preserved-420.png)。截图均为样例，不是设计稿。

原型构建的Lucide客户端指令提示及原生产包约512kB共享chunk体积提示均已记录；未关闭警告。它们没有导致本轮运行或构建失败。

## 竞品运行与文档复核

NeuroFlow在独立Chromium加载原始未改扩展源码，操作扩展文档，共3断言；不代表原生工具栏及跨站分组已验。Resettle使用原始UI/CSS/引擎+明确合成的组件fixture，共3断言；不是上游正式扩展E2E。两者均无pageerror，6张截图及源SHA/许可在`research/`，详细范围见[03](03_COMPETITORS_EVIDENCE.md)。

MIT `prd-review`实际应用于独立复核：首轮22项中18 PASS、4 NEEDS WORK，发现6项具体口径/合同问题；修复了拒绝者分母、同一候选归属、无时长对照、自由选择脚本、原子恢复合同及研究问题。最终定点复核22 PASS，结论Ready for Review，**仅指文档可评审**。初稿报告未覆盖，分别保存在`prd-review.*`与`prd-review-final.*`。

## 未验证及下一步

真实参与人数为0；没有访谈、真实A/B、自然采纳率或学习效果。网页原型不能证明真实扩展集成、原生侧栏容器、后台通知、手机/跨设备能力；没有接Ollama。真人屏幕阅读器、原生Chrome菜单200%缩放、移动端和长期行为仍未验收；CSS放大及键盘检查仅覆盖相应工程范围。

Gate0的研究交付与工程隔离已完成；Gate1因缺真人研究未通过，Gate2未开始。下一步使用08的自愿试用包比较同一个C/D候选与直接Resume，再决定投入最小正式工程、缩为D或停止。此轮没有发布、账号创建、付费、真实敏感数据上传或Git提交/推送；GitHub现状见09。

## 确实创建和修改的路径

- 新建 `docs/product/`：00–12编号文档、README索引、THIRD_PARTY_NOTICES。
- 新建 `prototypes/detour/`：源代码、独立配置/启动器/静态预览器、单元与网页测试、dist与原型README。完整逐文件名单见`delivery-manifest.json`。
- 新建 `scripts/product-discovery-baseline.mjs`、`scripts/product-discovery-check.mjs`、`scripts/package-product-discovery.mjs`，用于本轮基线/隔离检查和本地交付包。
- 只在根`README.md`、`docs/PRODUCT.md`、`docs/HANDOFF.md`末尾添加索引与状态，保留原文。
- 新建 `artifacts/product-discovery/`：研究来源/运行记录、截图、单独浏览器profile、副本、基线与隔离日志、PRD复核及本轮交付包。生成工作区、上游下载和profile排除分发/上传；精选合成证据列入交付清单。

所有路径均以 `M:\adhd_project` 为根。打包清单、校验和及实际ZIP路径保存在同证据目录；研究ZIP不是v0.1安装包，原有扩展安装方式未变。

研究交付包为 `artifacts/product-discovery/backtoit-v0.2-product-discovery.zip`：包含保留的v0.1源码/锁文件、产品文档、独立原型源码/测试/dist及精选合成证据。相邻`.sha256`与`package-verification.json`记录校验，`delivery-manifest.json`逐文件列路径、大小、SHA-256；解压内容已逐文件比对。高置信度token/私钥模式扫描无命中，范围和不能覆盖的秘密类型也写入清单。没有打包profile、真实任务数据库、依赖、浏览器运行时、上游下载、临时工作区或原v0.1安装包。

解压后无需项目依赖可用Node运行 `node prototypes/detour/scripts/serve-built.mjs` 体验预构建原型；修改源码或重跑工程测试仍按根锁文件安装项目依赖。研究包只在本机生成，未上传。
