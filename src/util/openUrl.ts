import { AppLauncher } from '@capacitor/app-launcher';
import { getActions, getGlobal } from '../global';

import { IFRAME_WHITELIST, IS_CAPACITOR, SUBPROJECT_URL_MASK } from '../config';
import { isTelegramUrl } from './url';

const [, SUBPROJECT_HOST_ENDING] = SUBPROJECT_URL_MASK.split('*');

export async function openUrl(
  url: string, options?: { isExternal?: boolean; title?: string; subtitle?: string },
) {
  if (isSubproject(url)) {
    url = `${url}#theme=${getGlobal().settings.theme}`;
  }

  if (
    !options?.isExternal
    && url.startsWith('http')
    && (IS_CAPACITOR || isSubproject(url) || isInIframeWhitelist(url))
    && !isTelegramUrl(url)
  ) {
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

function isSubproject(url: string) {
  const { host } = new URL(url);
  return host.endsWith(SUBPROJECT_HOST_ENDING) || host.startsWith('localhost:432');
}

function isInIframeWhitelist(url: string) {
  return IFRAME_WHITELIST.some((allowedOrigin) => url.startsWith(allowedOrigin.replace(/\*$/, '')));
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
