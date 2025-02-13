import { AppLauncher } from '@capacitor/app-launcher';
import { getActions } from '../global';

import { IS_CAPACITOR } from '../config';
import { isTelegramUrl } from './url';

export async function openUrl(
  url: string, options?: { isExternal?: boolean; title?: string; subtitle?: string },
) {
  if (IS_CAPACITOR && !options?.isExternal && url.startsWith('http') && !isTelegramUrl(url)) {
    getActions().openBrowser({
      url,
      title: options?.title,
      subtitle: options?.subtitle,
    });
  } else {
    const couldOpenApp = IS_CAPACITOR && await openAppSafe(url);
    if (!couldOpenApp) {
      window.open(url, '_blank', 'noopener');
    }
  }
}

export function handleOpenUrl(
  e: React.MouseEvent<HTMLAnchorElement, MouseEvent>,
) {
  e.preventDefault();
  void openUrl(e.currentTarget.href);
}

async function openAppSafe(url: string) {
  try {
    return (await AppLauncher.openUrl({ url })).completed;
  } catch (err) {
    return false;
  }
}
