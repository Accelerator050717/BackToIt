# 架构

单仓库 WXT + React + strict TypeScript + Tailwind CSS 的 Manifest V3 应用。正式构建自包含；没有后端或运行期开发服务器。

## 分层

- `entrypoints/background.ts`：事件驱动 MV3 worker，工具栏、命令、右键入口与消息验证。
- `entrypoints/sidepanel/`、`entrypoints/app/`：共用 React 应用的侧边栏及全页面入口。
- `src/ui/`：恢复卡、任务草稿、资源、暂存、管理、设置及双语界面。
- `src/domain/`：实体、严格输入和导入 schema、URL 检查、备份及 Markdown。
- `src/storage/repository.ts`：Dexie IndexedDB 仓库与统一事务化命令。
- `src/browser/`：一次性捕获、标签页恢复、会话草稿、设置与权限。
- `src/ai/`：确定性 LocalRulesProvider、隔离的 OllamaProvider 与输出校验。
- `tests/`：Vitest、RTL、fake-indexeddb 集成及浏览器/模型契约。
- `e2e/`：实际生产包安装到 Playwright 独立 persistent Chromium 的测试。

## 数据与并发

Task 保存标题、状态、三段草稿、首要资源、时间戳、版本及示例标记。Resource 保存 URL/标题、主动摘录、用途备注、来源与保存时间。Checkpoint 存不可变文字现场和资源 ID 引用。ParkingItem 独立于任务。AppState 保存唯一当前任务指针。

持久写入均经过仓库事务，当前任务指针和任务状态一起修改；IndexedDB 跨窗口事务串行化。字段更新检查 revision，旧版本拒绝并由界面提供冲突处理。资料变更更新任务 revision，使旧模型建议失效。组件订阅数据库更新，不把多份无版本整对象相互覆盖。

删除全部还会广播不含用户内容的 session 清理代号，让各窗口丢弃捕获队列、编辑框、导入预览等内存副本。捕获最终入库/写 session 与清空操作共用 Web Lock；捕获开始时记录代号，提交时若已变化则放弃旧结果。页面注入本身不持锁。删除单个资源后，对应编辑框也随数据库订阅更新而关闭。

开始新任务或恢复任务：原 active → paused，目标 → active，更新唯一指针。保存现场：写入快照并把任务设为 paused；完成/归档保留历史；重开可再次 active。永久删除任务级联清理资源、快照及撤销记录；删除资源移除旧快照引用，没有文本副本继续留在快照中。

时间戳为 Unix 毫秒，按数字排序，界面以用户本地时区显示。草稿保存显示提交完成状态。切换、暂停和导出前先等待尚未完成的草稿写入，不依赖 beforeunload。数据库错误不会触发静默重置。

备份 schemaVersion 1，最多 5 MiB 输入 / 500 任务 / 5000 资源 / 5000 快照 / 2000 暂存项；内容总配额 4 MiB（紧凑序列化，含备份元数据），保证应用导出的文件仍能导回。超配额写入会在事务内回滚，删除仍可用。严格校验字段、ID 唯一性、归属、引用及 URL，再整批事务导入。每次生成新 ID，active 导入为 paused，不抢占已有当前任务。设置和模型配置不进入内容备份。

## Worker 生命周期

顶层同步注册监听器。需要状态时重新读取持久仓库；不以 worker 全局变量、常驻端口或计时器保存任务。`chrome.storage.session` 只放允许浏览器重启时丢失的待归属捕获与反馈，内容完成入库后才显示保存成功。模型请求不进入数据库事务。

UI 设置放 `chrome.storage.local`，不会启动自动模型探测。用户内容仅在 IndexedDB。外部网页没有数据库消息 API；消息类型和来源都校验，没有 `externally_connectable`。

## 权限

默认仅 storage、activeTab、scripting、contextMenus、sidePanel。没有 tabs/history/cookies/webRequest、全站主机权限或常驻 content script。`chrome.tabs` 的创建、查询 API 本身并不都要求 tabs 权限；未经授权的 URL 不可见时新建页面，不猜测已有标签页身份。

工具栏 action、扩展快捷键或右键菜单才授予 activeTab。侧边栏一般按钮不能扩大授权。每次显式捕获都重新查询标签页并一次性注入，跨站导航或切换后不复用旧页面缓存。隐身模式禁用。Chrome 116 是 `sidePanel.open()` 所需最低版本；在用户事件同步路径调用它。

工具栏使用普通 `chrome.action.onClicked`，在其同步路径调用 `sidePanel.open()`；设置 `openPanelOnActionClick: false`。实际 Chromium 验证发现，浏览器内置的自动打开路径会绕过普通 action 的临时权限授予，导致侧边栏虽然打开但捕获仍无权限。当前实现经过真正 action 触发、授权检查和原生侧边栏内保存验证。工具栏打开动作不捕获或持久保存网页。

可选主机权限只列 localhost 与 127.0.0.1。Chrome 主机模式不能限制端口，代码和 CSP 进一步限制到 HTTP 11434 及允许的 Ollama API，拒绝重定向。关闭提供撤销权限。

## 核对的官方资料

访问日期：2026-10-02。

- [WXT entrypoints](https://wxt.dev/guide/essentials/entrypoints)
- [Chrome sidePanel](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)
- [Chrome activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab)
- [Chromium ExtensionActionRunner 的 action / side panel 分支](https://chromium.googlesource.com/chromium/src/+/main/chrome/browser/extensions/extension_action_runner.cc)
- [MV3 生命周期](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)
- [Chrome storage](https://developer.chrome.com/docs/extensions/reference/api/storage)
- [扩展跨域请求](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests)
- [Playwright 扩展测试](https://playwright.dev/docs/chrome-extensions)
- [Ollama Chat API](https://docs.ollama.com/api/chat)
- [Ollama structured outputs](https://docs.ollama.com/capabilities/structured-outputs)
- [Ollama FAQ / CORS / local-only](https://docs.ollama.com/faq)
