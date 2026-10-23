# 接着来 / BackToIt

2026-10-23：[v0.2b ADHD-first 产品与研究原型](docs/product/adhd-first/README.md) 已新增独立体验入口，聚焦启动、分心和任务重新进入。正式扩展仍为 v0.1；旧 v0.2 原型保留对照，未将研究功能合入生产。

留住做到哪一步，下次回来直接接着做。

一个本地优先的 Chrome Manifest V3 扩展。主动保存任务、网页、正文摘录、笔记和下一步，暂停后用恢复卡接回来。无需账号、网络或模型。不是诊疗产品，不记录浏览历史，不推断你真实完成了什么。

## 从 GitHub 开始

这是源码仓库：v0.1 扩展、v0.2 产品发现文档及独立 Detour 原型。克隆后先安装依赖并构建；仓库不含本机安装包、浏览器资料或环境配置。

```powershell
git clone https://github.com/Accelerator050717/BackToIt.git
cd BackToIt
pnpm install --frozen-lockfile
pnpm build
```

Node 22.12+，pnpm 11.19.0。完整命令见 [开发者说明](docs/DEVELOPMENT.md)；[v0.2 PRD](docs/product/05_V02_PRD.md) 和 [交互原型](prototypes/detour/README.md) 可以独立评审。

## Windows 安装

1. 在克隆目录完成上述安装与构建。
2. 在 Chrome 地址栏打开 `chrome://extensions`，打开右上角「开发者模式」。
3. 点「加载已解压的扩展」，选择 **`<克隆目录>/.output/chrome-mv3`**（该目录中包含 `manifest.json`）。
4. 点浏览器工具栏拼图图标，在「接着来 / BackToIt」旁点图钉。
5. 点接着来图标打开侧边栏，选择「开始一件事」。

运行 `pnpm verify`、`pnpm package` 后，分发包生成在 `artifacts/backtoit-0.1.0-chrome.zip`（不进入 Git）。先解压到一个固定位置，再加载其中包含 `manifest.json` 的目录。Chrome 不直接安装未签名 ZIP；不需要商店账号。正式包无需开发服务器，关闭终端仍可使用。最低 Chrome 116；实际测试浏览器与未验证范围见 [测试报告](docs/TEST_REPORT.md)。Edge 使用 Chromium API，但本次未做 Edge 实机验收。

## 第一次使用

1. 创建「理解参数方程」，可先只写标题。
2. 在资料页点击一次接着来工具栏图标获得当前页临时授权，再从侧边栏「保存当前网页」。也可在网页右键保存页面或选中的普通正文。
3. 如果当前页未授权，按提示点击工具栏图标，或用「链接或笔记」手动粘贴。切换网页不自动授权。
4. 点击「保存现场」，留下进度、卡点或下一步；三个字段均可空着。等待显示「已保存到本机」，或直接「保存并暂停」。
5. 下次回来先看到恢复卡。点「接着做」恢复当前任务，默认只打开首要资料，可另行勾选更多资料。不会关闭或改写原有标签页。
6. 突然想到别的事，收进「先放这里」；不会自动变成任务或提醒。

工具栏按钮只打开入口，不自动保存网页。正文选择不包含输入框、表单或可编辑区域。浏览器内置页、商店和部分受保护页面无法捕获，使用手动链接/笔记即可。敏感参数链接会要求你选择保留方式。不要将登录或授权链接当普通书签保存。

默认快捷键：`Ctrl+Shift+Y` 打开侧边栏，`Alt+Shift+S` 保存当前网页。若冲突，在 `chrome://extensions/shortcuts` 自行调整；网页内不注册键盘监听。macOS 对应 `Command+Shift+Y` / `Alt+Shift+S`。

全页面的设置中可切换完整中文/英文、导出 JSON、预览导入、清除示例及删除数据。JSON 不是加密文件；卸载扩展、清除浏览器资料或换电脑前请先备份。单任务可导出 Markdown。示例只会在你明确点击「看看示例」时创建。

## 开发与验证

在 PowerShell 中：

```powershell
# 在克隆目录执行
pnpm install --frozen-lockfile
pnpm dev
```

开发环境使用 Node 24（项目要求 Node 22.12+），pnpm 11.19。无需升级系统 Node。首次重现 E2E 可运行 `pnpm browsers:install` 安装 Playwright Chromium；不要传入自己的 Chrome 用户资料目录。测试只使用项目中的独立测试资料和回环地址测试服务器。本机缓存路径启动异常已用相同文件的项目内副本解决；测试自动优先选择该副本，细节见测试报告。

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
pnpm package
```

`pnpm verify` 串行运行静态检查、测试、构建和 E2E，把日志写入 `artifacts/logs/`，通过后记录构建文件 SHA-256。`pnpm package` 重新生成正式目录、ZIP 及 SHA-256 校验文件，并核对其与最近通过验证的构建一致。改过应用代码后先重新运行 `pnpm verify`。依赖由 `pnpm-lock.yaml` 锁定。

## 可选本地 AI

默认关闭，本地规则已能完成完整闭环。只在你主动启用、授予回环权限、选择已安装本地模型，并点击「帮我整理一下」后请求本机 Ollama。不会下载模型，不连接付费云模型。连接和安全配置见 [隐私说明](docs/PRIVACY.md)。真实 Ollama 推理的验收状态见测试报告；契约测试不等于真实推理成功。

## 项目文档

- [产品范围与取舍](docs/PRODUCT.md)
- [架构与权限](docs/ARCHITECTURE.md)
- [隐私和 Ollama 配置](docs/PRIVACY.md)
- [测试报告与真实证据](docs/TEST_REPORT.md)
- [演示及用户验证计划](docs/DEMO.md)
- [接续开发说明](docs/HANDOFF.md)

## v0.2 产品发现与独立原型（2026-10-22）

本轮研究、PRD、竞品证据、交互设计与试用计划见 [产品发现索引](docs/product/README.md)。可运行网页原型在 `prototypes/detour/`，启动方式见其 [README](prototypes/detour/README.md)。它只使用演示样例，不接触正式任务；v0.1 核心、权限、安装目录和原 ZIP 保持原样。实际复验和隔离证据见 [本轮验收](docs/product/12_DELIVERY_AND_VALIDATION.md)。
