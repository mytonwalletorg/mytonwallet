import { AppLauncher } from '@capacitor/app-launcher';
import { getActions } from '../global';

import { IS_CAPACITOR } from '../config';
import safeExec from './safeExec';

export async function openUrl(url: string, isExternal?: boolean) {
  if (IS_CAPACITOR && !isExternal) {
    getActions().openBrowser({ url });
  } else if (IS_CAPACITOR && await canOpenApp(url)) {
    AppLauncher.openUrl({ url });
  } else {
    window.open(url, '_blank', 'noopener');
  }
}

function canOpenApp(url: string) {
  return safeExec(async () => {
    const result = await AppLauncher.canOpenUrl({ url });
    return result.value;
  });
}
