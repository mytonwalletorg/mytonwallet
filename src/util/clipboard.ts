import { Clipboard } from '@capacitor/clipboard';

import { IS_CAPACITOR } from '../config';
import { vibrate } from './capacitor';

const textCopyEl = document.createElement('textarea');
textCopyEl.setAttribute('readonly', '');
textCopyEl.tabIndex = -1;
textCopyEl.className = 'visually-hidden';

export const copyTextToClipboard = (str: string): Promise<void> => {
  if (IS_CAPACITOR) {
    void vibrate();
    return Clipboard.write({
      string: str,
    });
  }
  return navigator.clipboard.writeText(str);
};

export async function readClipboardContent() {
  if (IS_CAPACITOR) {
    const { value, type } = await Clipboard.read();
    void vibrate();
    return { text: value, type };
  } else {
    const text = await navigator.clipboard.readText();
    return { text, type: 'text/plain' };
  }
}
