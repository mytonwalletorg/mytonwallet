import { AppLauncher } from '@capacitor/app-launcher';
import { getActions } from '../global';

import { IS_CAPACITOR } from '../config';

export async function openUrl(url: string, isExternal?: boolean, title?: string, subtitle?: string) {
  if (IS_CAPACITOR && !isExternal && url.startsWith('http')) {
    getActions().openBrowser({ url, title, subtitle });
  } else {
    const couldOpenApp = IS_CAPACITOR && await openAppSafe(url);
    if (!couldOpenApp) {
      window.open(url, '_blank', 'noopener');
    }
  }
}

export function handleOpenUrl(e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) {
  e.preventDefault();
  openUrl(e.currentTarget.href);
}

async function openAppSafe(url: string) {
  try {
    return (await AppLauncher.openUrl({ url })).completed;
  } catch (err) {
    return false;
  }
}
