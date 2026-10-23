import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: '__MSG_extensionName__',
    description: '__MSG_extensionDescription__',
    default_locale: 'zh_CN',
    version: '0.1.0',
    minimum_chrome_version: '116',
    permissions: ['storage', 'activeTab', 'scripting', 'contextMenus', 'sidePanel'],
    optional_host_permissions: ['http://localhost/*', 'http://127.0.0.1/*'],
    action: { default_title: '__MSG_actionTitle__' },
    icons: { 16: 'icon/16.png', 32: 'icon/32.png', 48: 'icon/48.png', 128: 'icon/128.png' },
    incognito: 'not_allowed',
    commands: {
      'open-panel': {
        suggested_key: { default: 'Ctrl+Shift+Y', mac: 'Command+Shift+Y' },
        description: '__MSG_openPanel__',
      },
      'save-page': {
        suggested_key: { default: 'Alt+Shift+S', mac: 'Alt+Shift+S' },
        description: '__MSG_savePage__',
      },
    },
    content_security_policy: {
      extension_pages:
        "script-src 'self'; object-src 'none'; connect-src 'self' http://localhost:11434 http://127.0.0.1:11434; img-src 'self' data:; style-src 'self' 'unsafe-inline'; base-uri 'none'",
    },
  },
});
