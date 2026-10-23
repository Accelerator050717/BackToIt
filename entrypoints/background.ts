import { defineBackground } from 'wxt/utils/define-background';
import { registerBackground } from '../src/browser/background';

export default defineBackground(() => {
  registerBackground();
});
