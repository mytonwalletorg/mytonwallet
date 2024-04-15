import { isSelfDeeplink } from '../../util/deeplink';
import { parseTonDeeplink } from '../../util/ton/deeplinks';
import { callApi } from '../../api/providers/extension/connectorForPageScript';

type DeeplinkParams = {
  to: string;
  amount?: string | bigint;
  comment?: string;
} | undefined;

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
  if (tryHandleDeeplink(url)) {
    // eslint-disable-next-line no-null/no-null
    return null;
  }
  return originalOpenFn(url, ...args);
}

function tryHandleDeeplink(url: any) {
  if (isSelfDeeplink(url)) {
    void callApi('processDeeplink', { url });
    return true;
  }

  const params: DeeplinkParams = parseTonDeeplink(url);
  if (!params) return false;
  if (typeof params.amount === 'bigint') {
    params.amount = params.amount.toString();
  }

  void callApi('prepareTransaction', params);
  return true;
}
