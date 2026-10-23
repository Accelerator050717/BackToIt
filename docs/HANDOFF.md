# 接续开发

## 项目入口

最初 v0.1 交付时目录为空且无 Git 仓库，当时未 commit、push 或发布商店。2026-10-22 用户另行授权同步到 [BackToIt 私有仓库](https://github.com/Accelerator050717/BackToIt)，默认分支 main。干净克隆的运行与验证方式见 [开发者说明](DEVELOPMENT.md)；历史安装包及本机资料不进入 Git。

先读 `README.md` 安装方式、`docs/TEST_REPORT.md` 的实际通过项与边界，再看 `IMPLEMENTATION.md` 的早期接口约定和源码。后续源码为准。

## 当前交付状态

v0.1 已完成任务创建、主动网页/正文捕获、现场草稿与快照、暂停恢复、资料管理、独立暂存、任务搜索与状态管理、JSON 备份导入、Markdown 导出、示例清理和删除。默认本地规则可离线运行，提供完整中文/英文和可选 Ollama 适配器。

静态检查和生产构建通过；真实扩展 E2E 覆盖浏览器重启、恢复、备份及降级。工具栏临时授权和原生侧边栏保存已有真实浏览器证据。生产目录为 `.output/chrome-mv3`，安装 ZIP 和验证日志在 `artifacts/`。最终测试数量、范围、剩余人工检查及证据索引见测试报告。

## 重要约束

- 坚持「保存任务现场 → 接回下一步」，不要将 v0.1 演变成复杂 Todo/AI 聊天平台。
- 无网络/模型必须可用。模型默认关闭、不自动探测；只用户主动触发的本机请求。
- 保持无全站权限、无常驻脚本、无浏览历史分析。不能用加权限掩盖 activeTab 失效。
- 所有写入继续经过 `repo` 事务。不要直接从组件修改 Dexie 表。
- 字段更新使用 revision；不以旧全量对象覆盖新状态。快照不存资料文本副本。
- 删除资源同时清关联引用、撤销副本及 UI 内存建议；删除全部也处理临时 session 捕获。
- 备份采用严格 v1 schema、4 MiB 总内容配额及 5 MiB 文件上限；导入只重映射创建，不覆盖。
- 不对模型语义正确性做程序无法证明的保证；维持建议标记、来源 ID、过期处理和采用动作。
- 不改回 `openPanelOnActionClick: true`；普通 action 监听器同步打开侧边栏的方式同时保留 activeTab 授予路径，见架构说明及真实入口测试。

## 开发位置

- 数据可靠性：`src/storage/repository.ts`、`src/domain/schemas.ts`、`tests/storage.test.ts`。
- 草稿/冲突：`src/ui/useTaskDraft.ts`、`TaskView.tsx`。
- 捕获权限：`src/browser/capture.ts`、`background.ts`、`adapter.ts`。
- AI：`src/ai/providers.ts`、`src/ui/AIAssistant.tsx`。
- 备份/删除和可选权限：`src/ui/SettingsView.tsx`。
- 真实浏览器证据：`e2e/extension.spec.ts`、`artifacts/`。

## 已知支持边界

- Chrome 116+，Edge 未实测；不承诺 Firefox/Safari/手机。
- 仅捕获顶层文档普通正文，iframe 选区明确拒绝，改为独立标签页或手动笔记。
- 服务连接只支持 Ollama loopback HTTP11434，本地模型选择限通过权重与元数据检查的 GGUF completion 模型。
- 无云同步；本地内容不是加密保险箱，外部明文备份由用户自行保管。
- 输入后明确显示保存完成前关闭扩展，最后尚未提交的字符可能丢失；不声称恢复从未保存的思路。
- 原生工具栏经浏览器 CDP action 路径验证，侧边栏真实容器已操作；系统右键、物理快捷键、可选权限对话框及屏幕阅读器仍需人工验收。真实 Ollama 推理未验收。
- 生产构建共享 UI chunk 约 510 kB，Vite 提示超过 500 kB；当前仍为本地单包且运行验证通过，后续可按实际启动性能需要拆分。
- 本机 Playwright 缓存路径出现 Windows SxS 启动错误。项目内 `.playwright-browsers` 中未经修改的相同运行时可正常启动；不随扩展 ZIP 分发，不依赖用户浏览器配置。

## 下一次工作

优先完成测试报告中尚未验收的人工项目与小规模真实用户验证；观察恢复资料是否够少、下一步是否足够具体、记录是否造成负担。功能扩展应来自这些观察，而非先加统计、通知或更多模型。

## v0.2 产品发现接续（2026-10-22）

本轮新增 [产品文档索引](product/README.md) 和独立的 `prototypes/detour/` 网页原型。C留白休息、B有限互动、D无内容返回用于比较，正式候选优先C/D，尚无真人访谈或正式发布批准。v0.1核心/schema/权限/.output/ZIP保留；重新运行的105项测试和6条扩展E2E、原型测试及构建隔离证据见 [本轮验收](product/12_DELIVERY_AND_VALIDATION.md)。下一步先做知情同意的小样本比较，再决定是否进入真实扩展工程。

## v0.2b ADHD-first 接续（2026-10-23）

[新一轮索引](product/adhd-first/README.md) 记录ADHD相关启动/切换困难如何转成机制；`prototypes/adhd-first`（4178）新增 Tiny Start、固定三片 Tiny Spark、Quiet Pause、Parking 和直接 Resume。旧 Detour（4174）及原结论保留。主线改为优先验证 Tiny Start，未把新目标伪装成真人发现。实际测试、首次失败修复、SHA隔离和Git审阅分支见[新验收报告](product/adhd-first/07_TEST_AND_SKILLS_REPORT.md)。正式v0.1核心/schema/权限/安装产物不变，main不合并；仍需按两阶段协议研究真实价值。
