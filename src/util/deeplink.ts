import { BottomSheet } from 'native-bottom-sheet';
import { getActions, getGlobal } from '../global';

import { ActiveTab } from '../global/types';

import { TON_TOKEN_SLUG } from '../config';
import { selectCurrentAccountState } from '../global/selectors';
import { callApi } from '../api';
import { isTonConnectDeeplink, parseTonDeeplink } from './ton/deeplinks';
import { waitRender } from './renderPromise';
import { pause } from './schedulers';
import { tonConnectGetDeviceInfo } from './tonConnectEnvironment';
import { IS_DELEGATING_BOTTOM_SHEET } from './windowEnvironment';

import { getIsPortrait } from '../hooks/useDeviceScreen';

type UrlOpener = (url: string) => void | Promise<void>;

// Both to close current Transfer Modal and delay when app launch
const PAUSE = 700;

export function processDeeplink(url: string, urlOpener?: UrlOpener) {
  if (isTonConnectDeeplink(url)) {
    return processTonConnectDeeplink(url, urlOpener);
  } else {
    return processTonDeeplink(url);
  }
}

export async function processTonDeeplink(url: string) {
  const params = parseTonDeeplink(url);
  if (!params) return false;

  await waitRender();

  const actions = getActions();
  const global = getGlobal();

  if (!global.currentAccountId) {
    return false;
  }

  const accountState = selectCurrentAccountState(global);
  const isPortrait = getIsPortrait();

  if (isPortrait || accountState?.landscapeActionsActiveTabIndex !== ActiveTab.Transfer) {
    if (IS_DELEGATING_BOTTOM_SHEET) {
      await BottomSheet.release({ key: '*' });
      await pause(PAUSE);
    }

    getActions().startTransfer({
      isPortrait: true,
      tokenSlug: TON_TOKEN_SLUG,
      toAddress: params.to,
      amount: params.amount,
      comment: params.comment,
    });
  } else {
    actions.setTransferToAddress({ toAddress: params.to });
    actions.setTransferAmount({ amount: params.amount });
    actions.setTransferComment({ comment: params.comment });
  }

  return true;
}

export async function processTonConnectDeeplink(url: string, urlOpener?: UrlOpener) {
  if (!isTonConnectDeeplink(url)) {
    return false;
  }

  const deviceInfo = tonConnectGetDeviceInfo();
  const returnUrl = await callApi('startSseConnection', url, deviceInfo);

  if (returnUrl && urlOpener) {
    urlOpener(returnUrl);
  }

  return true;
}
