import { BottomSheet } from 'native-bottom-sheet';
import { getActions, getGlobal } from '../global';

import type { ApiNft } from '../api/types';
import { ActiveTab } from '../global/types';

import {
  CHECKIN_URL,
  DEFAULT_CEX_SWAP_SECOND_TOKEN_SLUG,
  SELF_PROTOCOL,
  SELF_UNIVERSAL_URLS,
  TON_TOKEN_SLUG,
} from '../config';
import { selectCurrentAccount } from '../global/selectors';
import { callApi } from '../api';
import { isTonConnectDeeplink, parseTonDeeplink } from './ton/deeplinks';
import { logDebug, logDebugError } from './logs';
import { openUrl } from './openUrl';
import { waitRender } from './renderPromise';
import { pause } from './schedulers';
import { tonConnectGetDeviceInfo } from './tonConnectEnvironment';
import { isValidHttpsUrl } from './url';
import { IS_DELEGATING_BOTTOM_SHEET } from './windowEnvironment';

import { getIsLandscape, getIsPortrait } from '../hooks/useDeviceScreen';

type UrlOpener = (url: string) => void | Promise<void>;

enum DeeplinkCommand {
  Browse = 'browse',
  Checkin = 'checkin',
  CheckinWithR = 'r',
  Swap = 'swap',
  BuyWithCrypto = 'buy-with-crypto',
  BuyWithCard = 'buy-with-card',
  Stake = 'stake',
}

// Both to close current Transfer Modal and delay when app launch
const PAUSE = 700;

let urlAfterSignIn: string | undefined;
let urlOpenerAfterSignIn: UrlOpener | undefined;

export function processDeeplinkAfterSignIn() {
  if (!urlAfterSignIn) return;

  processDeeplink(urlAfterSignIn, urlOpenerAfterSignIn);

  urlAfterSignIn = undefined;
  urlOpenerAfterSignIn = undefined;
}

export function processDeeplink(url: string, urlOpener?: UrlOpener, nft?: ApiNft) {
  if (!getGlobal().currentAccountId) {
    urlAfterSignIn = url;
    urlOpenerAfterSignIn = urlOpener;
  }

  if (isTonConnectDeeplink(url)) {
    return processTonConnectDeeplink(url, urlOpener);
  } else if (isSelfDeeplink(url)) {
    return processSelfDeeplink(url);
  } else {
    return processTonDeeplink(url, nft);
  }
}

export async function processTonDeeplink(url: string, nft?: ApiNft) {
  const params = parseTonDeeplink(url);
  if (!params) return false;

  await waitRender();

  const actions = getActions();
  const global = getGlobal();

  if (!global.currentAccountId) {
    return false;
  }

  if (IS_DELEGATING_BOTTOM_SHEET) {
    await BottomSheet.release({ key: '*' });
    await pause(PAUSE);
  }

  actions.startTransfer({
    isPortrait: getIsPortrait(),
    tokenSlug: TON_TOKEN_SLUG,
    toAddress: params.to,
    amount: !nft ? params.amount : undefined,
    comment: params.comment,
    binPayload: !nft ? params.binPayload : undefined,
    nft,
  });

  if (getIsLandscape()) {
    actions.setLandscapeActionsActiveTabIndex({ index: ActiveTab.Transfer });
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

export function processSelfDeeplink(deeplink: string) {
  try {
    deeplink = SELF_UNIVERSAL_URLS.reduce((result, url) => result.replace(url, SELF_PROTOCOL), deeplink);
    const deeplinkObject = new URL(deeplink);
    const command = (deeplinkObject.hostname || deeplinkObject.pathname) // Behavior is different in browsers
      .split('/').find(Boolean) as string | undefined;
    const actions = getActions();
    const global = getGlobal();
    const { isTestnet } = global.settings;
    const isLedger = selectCurrentAccount(global)?.ledger;

    logDebug('Processing deeplink', deeplink);

    switch (command) {
      case DeeplinkCommand.Browse: {
        const url = deeplinkObject.searchParams.get('url');
        if (!url || !isValidHttpsUrl(url)) {
          actions.showError({ error: 'Invalid url' });
          return;
        }

        openUrl(url);
        break;
      }

      case DeeplinkCommand.Checkin: {
        const url = `${CHECKIN_URL}/${deeplinkObject.search}`;
        openUrl(url);
        break;
      }

      case DeeplinkCommand.CheckinWithR: {
        const parts = deeplinkObject.pathname.split('/');
        const url = `${CHECKIN_URL}/?r=${parts[parts.length - 1]}`;
        openUrl(url);
        break;
      }

      case DeeplinkCommand.Swap: {
        if (isTestnet) {
          actions.showError({ error: 'Swap is not supported in Testnet.' });
        } else if (isLedger) {
          actions.showError({ error: 'Swap is not yet supported by Ledger.' });
        } else {
          actions.startSwap();
        }
        break;
      }

      case DeeplinkCommand.BuyWithCrypto: {
        if (isTestnet) {
          actions.showError({ error: 'Swap is not supported in Testnet.' });
        } else if (isLedger) {
          actions.showError({ error: 'Swap is not yet supported by Ledger.' });
        } else {
          actions.startSwap({
            tokenInSlug: DEFAULT_CEX_SWAP_SECOND_TOKEN_SLUG,
            tokenOutSlug: TON_TOKEN_SLUG,
            amountIn: '100',
          });
        }
        break;
      }

      case DeeplinkCommand.BuyWithCard: {
        if (isTestnet) {
          actions.showError({ error: 'Buying with card is not supported in Testnet.' });
        } else {
          actions.openOnRampWidgetModal();
        }
        break;
      }

      case DeeplinkCommand.Stake: {
        if (isTestnet) {
          actions.showError({ error: 'Staking is not supported in Testnet.' });
        } else {
          actions.startStaking();
        }
        break;
      }
    }
  } catch (err) {
    logDebugError('processSelfDeeplink', err);
  }
}

export function isSelfDeeplink(url: string) {
  return url.startsWith(SELF_PROTOCOL) || SELF_UNIVERSAL_URLS.some((u) => url.startsWith(u));
}
