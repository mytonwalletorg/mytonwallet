import { getActions } from '../global';

import { IS_CAPACITOR } from '../config';

export function openUrl(url: string, isExternal?: boolean) {
  if (!IS_CAPACITOR || isExternal) {
    window.open(url, '_blank', 'noopener');
    return;
  }

  getActions().openBrowser({ url });
}
