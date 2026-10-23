import type { Language } from '../domain/types';

export class AppError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'AppError';
  }
}

const messages: Record<string, [string, string]> = {
  NO_PERMISSION: [
    '请点击浏览器工具栏里的接着来图标，或用网页右键保存；也可以手动粘贴链接。',
    'Click the BackToIt toolbar icon or use the page context menu, then save. You can also paste a link.',
  ],
  RESTRICTED_PAGE: [
    '浏览器不允许读取此页面。请换到普通网页，或手动添加笔记。',
    'The browser restricts access to this page. Use a regular webpage or add a note manually.',
  ],
  NO_PAGE: [
    '没有可保存的当前网页。请换到普通网页后再试。',
    'There is no current webpage to save. Open a regular webpage and try again.',
  ],
  PAGE_CHANGED: [
    '页面已切换或跳转，请在要保存的页面重新操作。',
    'The page changed. Repeat the save action on the page you want.',
  ],
  INCOGNITO: ['接着来不采集隐身窗口内容。', 'BackToIt does not capture incognito pages.'],
  EDITABLE_SELECTION: [
    '为保护隐私，不保存输入框、表单或可编辑区域中的文字。',
    'For privacy, text inside inputs, forms, or editable areas is not captured.',
  ],
  NO_SELECTION: [
    '未找到普通正文中的选中文字，请重新选中后使用右键菜单。',
    'No body-text selection was found. Select text again and use the context menu.',
  ],
  FRAME_SELECTION: [
    '此嵌入页面无法安全读取。请在独立标签页打开资料，或手动添加笔记。',
    'This embedded page cannot be captured safely. Open it in its own tab or add a note manually.',
  ],
  NO_CURRENT_TASK: [
    '先选择或创建一个任务；本次内容已暂存。',
    'Choose or create a task first. Your capture is waiting here.',
  ],
  SAVE_FAILED: [
    '未能保存，请重试。本次内容仍保留在临时草稿中。',
    'Could not save. Try again; this capture remains in the temporary draft.',
  ],
  OPERATION_FAILED: ['未能完成操作，请重试。', 'Could not complete the action. Please try again.'],
  DATA_CLEARED: [
    '数据已清空，本次尚未完成的捕获已取消。',
    'Data was cleared. This unfinished capture was cancelled.',
  ],
  STORAGE_FAILED: [
    '未能写入本机存储，尚未确认保存成功。请重试。',
    'Could not write to local storage. Saving has not been confirmed. Please try again.',
  ],
  LIMIT_REACHED: [
    '已达到 4 MiB 内容容量或条目数量上限。请先导出备份，再移除不再需要的内容。',
    'The 4 MiB content capacity or record limit was reached. Export a backup, then remove content you no longer need.',
  ],
  NOT_FOUND: [
    '这项内容已被移除，可能是在另一个窗口中。请查看最新记录。',
    'This item was removed, possibly in another window. Review the latest records.',
  ],
  CORRUPT_DATA: [
    '部分本机记录无法读取，现有数据没有被清空。请保留备份并联系维护者。',
    'Some local records could not be read. Existing data has not been cleared. Keep your backup and contact the maintainer.',
  ],
  IMPORT_IN_PROGRESS: [
    '正在导入，请等待当前导入完成。',
    'An import is already running. Wait for it to finish.',
  ],
  PANEL_FAILED: [
    '侧边栏未能打开，请点击工具栏图标；本次内容可在扩展页面查看。',
    'The side panel could not open. Click the toolbar icon or open the extension page to view this capture.',
  ],
  INVALID_MESSAGE: ['操作无效，请重新打开扩展。', 'Invalid request. Reopen the extension and try again.'],
  AI_DISABLED: [
    '本地 AI 已关闭；仍可使用本地恢复卡。',
    'Local AI is off. Your local recovery card remains available.',
  ],
  AI_PERMISSION: [
    '未授予本机模型连接权限，请在设置中主动开启。',
    'Local model access was not granted. Enable it in settings.',
  ],
  AI_ENDPOINT: [
    '仅支持 localhost 或 127.0.0.1 的 11434 端口。',
    'Only localhost or 127.0.0.1 on port 11434 is supported.',
  ],
  AI_UNAVAILABLE: [
    '本地模型无法连接。请检查 Ollama 和扩展 origin 的 CORS 配置；原始记录不受影响。',
    'Cannot reach the local model. Check Ollama and CORS for this extension origin. Your records are unchanged.',
  ],
  AI_NO_MODELS: [
    '没有可用的已安装本地模型。请自行安装后重新测试连接。',
    'No installed local models are available. Install one yourself, then test again.',
  ],
  AI_MODEL: [
    '所选模型未通过本地模型检查，请重新测试连接并选择模型。',
    'The selected model did not pass local-model checks. Test the connection and select a model again.',
  ],
  AI_INVALID_OUTPUT: [
    '模型返回的建议不符合安全格式，已保留本地恢复卡。',
    'The model suggestion did not pass validation. Your local recovery card is still available.',
  ],
  AI_INPUT_TOO_LARGE: [
    '本次内容过大，请减少要整理的资料。',
    'This input is too large. Reduce the material to organize.',
  ],
  AI_TIMEOUT: [
    '本地模型响应超时；可以重试或继续使用本地恢复卡。',
    'The local model timed out. Retry or use your local recovery card.',
  ],
  AI_CANCELLED: [
    '已取消整理；原始记录未改变。',
    'Organizing was cancelled. Your original records are unchanged.',
  ],
  AI_BUSY: ['正在整理，请等待或先取消。', 'A request is already running. Wait or cancel it first.'],
  CONFLICT: [
    '内容已在另一处更新，请查看最新记录后重试。',
    'These records changed in another window. Review the latest version and try again.',
  ],
};

export function errorCode(error: unknown, fallback = 'OPERATION_FAILED'): string {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string')
    return error.code;
  return fallback;
}

export function messageForError(error: unknown, language: Language): string {
  const code = typeof error === 'string' ? error : errorCode(error);
  return (messages[code] ?? ['未能完成操作，请重试。', 'Could not complete the action. Please try again.'])[
    language === 'en' ? 1 : 0
  ]!;
}
