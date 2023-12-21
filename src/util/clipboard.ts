import { logDebugError } from './logs';

export const CLIPBOARD_ITEM_SUPPORTED = window.navigator.clipboard && window.ClipboardItem;

const textCopyEl = document.createElement('textarea');
textCopyEl.setAttribute('readonly', '');
textCopyEl.tabIndex = -1;
textCopyEl.className = 'visually-hidden';

export const copyTextToClipboard = (str: string): Promise<void> => {
  return navigator.clipboard.writeText(str);
};

export const copyImageToClipboard = (imageUrl?: string) => {
  if (!imageUrl) return;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const imageEl = new Image();
  imageEl.onload = (e: Event) => {
    if (ctx && e.currentTarget) {
      const img = e.currentTarget as HTMLImageElement;
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0, img.width, img.height);
      canvas.toBlob(copyBlobToClipboard, 'image/png', 1);
    }
  };

  imageEl.src = imageUrl;
};

async function copyBlobToClipboard(pngBlob: Blob | null) {
  if (!pngBlob || !CLIPBOARD_ITEM_SUPPORTED) {
    return;
  }

  try {
    await window.navigator.clipboard.write?.([
      new ClipboardItem({
        [pngBlob.type]: pngBlob,
      }),
    ]);
  } catch (err) {
    logDebugError('copyBlobToClipboard', err);
  }
}
