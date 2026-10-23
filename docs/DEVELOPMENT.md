# 开发者接续入口

正式扩展保持 v0.1；v0.2 是产品发现文档与独立 Detour 网页原型。请先读 [产品发现索引](product/README.md)、[PRD](product/05_V02_PRD.md) 和 [交互规格](product/11_INTERACTION_SPEC.md)。没有真人研究结果，Detour 尚未合入扩展。

## 干净克隆

需要 Node 22.12+（已验证 Node 24）及 package.json 指定的 pnpm 11.19.0。使用可访问此私有仓库的 GitHub 账户：

```powershell
git clone https://github.com/Accelerator050717/BackToIt.git
cd BackToIt
pnpm install --frozen-lockfile
```

不需要 API Key、账号后端、云模型或本机 .npmrc；不要拷贝他人的环境文件或 Chrome 用户资料。安装会运行项目自身的 WXT prepare，生成忽略的 .wxt 类型文件。

## v0.1 扩展

```powershell
pnpm dev
# 或生成可离线加载的正式目录
pnpm build
```

在 Chrome 116+ 的 chrome://extensions 开启开发者模式，加载克隆目录内的 .output/chrome-mv3。开发模式的路径见 WXT 启动输出。源码仓库不包含本机构建包，克隆后先构建。

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm browsers:install
pnpm test:e2e
```

E2E 需要先 pnpm build。pnpm verify 按正确顺序运行上述检查，结果只写入忽略的 artifacts。pnpm package 在验证通过后生成 ZIP。测试只使用隔离资料与合成任务；真实 Ollama、系统快捷键和物理设备边界见 [测试报告](TEST_REPORT.md)。

## Detour 独立原型

以下命令均从仓库根目录运行，复用根锁文件依赖，不需在原型子目录另装包。

```powershell
node prototypes/detour/scripts/tool.mjs dev
```

访问 http://127.0.0.1:4174/。它使用自己的演示数据，不读取正式扩展数据库。

```powershell
node prototypes/detour/scripts/tool.mjs typecheck
node prototypes/detour/scripts/tool.mjs test
node prototypes/detour/scripts/tool.mjs build
node prototypes/detour/scripts/tool.mjs browser-test
```

浏览器测试前需要 pnpm browsers:install 和原型 build。build 后可用 node prototypes/detour/scripts/serve-built.mjs 启动只依赖 Node 的预览；克隆中没有 dist，不能跳过首次构建。详见 [原型 README](../prototypes/detour/README.md)。

## 证据、隐私和维护

[精选证据](product/evidence/README.md) 保存实际测试记录与合成样例截图。个人目录、邮箱已从证据副本去除；原始本地记录没有被改写。它们是带日期的历史结果，不能冒充未来提交的新测试。

浏览器资料、真实用户数据、依赖、环境配置、下载的上游源码、dist、.output、ZIP 和完整运行日志不进入 Git。研究历史脚本 product-discovery-check / baseline / package-product-discovery 依赖原工作区的忽略证据与安装包，属于当次交付工具；干净克隆使用上方标准命令重新验证，不需要运行这些历史脚本。

Tailwind 自动扫描可能从文档或生成文件识别出样式候选。精选证据目录有独立忽略规则，首次导入采用明确的强制添加清单；更新证据时仍须审核后逐项添加，避免提交生成工作区或个人数据。

本仓库保持私有，没有替项目选择开源许可证。依赖和研究方法的归属见 [第三方说明](product/THIRD_PARTY_NOTICES.md)。ChatGPT 的 GitHub 连接也必须具有此私有仓库的访问权；仓库地址本身不授予权限。
