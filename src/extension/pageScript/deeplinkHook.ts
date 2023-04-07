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
  if (tryHandleDeeplink(url)) {
    // eslint-disable-next-line no-null/no-null
    return null;
  }
  return originalOpenFn(url, ...args);
}

function tryHandleDeeplink(value: any) {
  if (typeof value !== 'string' || !value.startsWith('ton://transfer/')) {
    return false;
  }

  try {
    const url = new URL(value);
    const params = {
      to: url.pathname.replace('//transfer/', ''),
      amount: url.searchParams.get('amount'),
      text: url.searchParams.get('text'),
    };
    void callApi('prepareTransaction', {
      to: params.to,
      amount: params.amount,
      comment: params.text,
    });
    return true;
  } catch (err) {
    return false;
  }
}
