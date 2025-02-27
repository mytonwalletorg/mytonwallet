import { Clipboard } from '@capacitor/clipboard';

import { IS_CAPACITOR, IS_TELEGRAM_APP } from '../config';
import { vibrate } from './haptics';
import { getTelegramApp } from './telegram';

const textCopyEl = document.createElement('textarea');
textCopyEl.setAttribute('readonly', '');
textCopyEl.tabIndex = -1;
textCopyEl.className = 'visually-hidden';

export const copyTextToClipboard = (str: string): Promise<void> => {
  void vibrate();

  if (IS_CAPACITOR) {
    return Clipboard.write({
      string: str,
    });
  }

  return navigator.clipboard.writeText(str);
};

export async function readClipboardContent() {
  if (IS_TELEGRAM_APP) {
    return new Promise((resolve: ({ text, type }: { text: string; type: string | undefined }) => void) => {
      getTelegramApp()?.readTextFromClipboard((text) => {
        void vibrate();
        resolve({ text, type: 'text/plain' });
      });
    });
  } else if (IS_CAPACITOR) {
    const { value, type } = await Clipboard.read();
    void vibrate();
    return { text: value, type };
  } else {
    const text = await navigator.clipboard.readText();
    return { text, type: 'text/plain' };
  }
}
