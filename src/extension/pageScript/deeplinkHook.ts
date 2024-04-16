import { ALL_PROTOCOLS } from '../../util/deeplink/constants';
import { callApi } from '../../api/providers/extension/connectorForPageScript';

const originalOpenFn = window.open;
let isDeeplinkHookEnabled: boolean | undefined;

export function doDeeplinkHook(isTurnedOn: boolean) {
  if (isTurnedOn === Boolean(isDeeplinkHookEnabled)) {
    return;
  }

  if (isTurnedOn) {
    window.addEventListener('click', clickHandler, false);
    window.open = patchedOpenFn;
  } else {
    window.removeEventListener('click', clickHandler);
    window.open = originalOpenFn;
  }

  isDeeplinkHookEnabled = isTurnedOn;
}

function clickHandler(e: MouseEvent) {
  const linkEl = (e.target as HTMLElement)?.closest('a');

  if (linkEl && tryHandleDeeplink(linkEl.href)) {
    e.preventDefault();
  }
}

function patchedOpenFn(url?: string | URL, ...args: any[]) {
  if (url && tryHandleDeeplink(String(url))) {
    // eslint-disable-next-line no-null/no-null
    return null;
  }
  return originalOpenFn(url, ...args);
}

function tryHandleDeeplink(url: string) {
  url = url.replace(/^http:\/\//, 'https://');
  if (!ALL_PROTOCOLS.some((protocol) => url.startsWith(protocol))) {
    return false;
  }

  void callApi('processDeeplink', { url });
  return true;
}
