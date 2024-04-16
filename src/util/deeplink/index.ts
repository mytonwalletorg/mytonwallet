import { BottomSheet } from 'native-bottom-sheet';
import { getActions, getGlobal } from '../../global';

import type { ApiNft } from '../../api/types';
import { ActiveTab } from '../../global/types';

import { DEFAULT_CEX_SWAP_SECOND_TOKEN_SLUG, DEFAULT_SWAP_SECOND_TOKEN_SLUG, TON_TOKEN_SLUG } from '../../config';
import { selectCurrentAccount } from '../../global/selectors';
import { callApi } from '../../api';
import { logDebug, logDebugError } from '../logs';
import { openUrl } from '../openUrl';
import { waitRender } from '../renderPromise';
import { pause } from '../schedulers';
import { tonConnectGetDeviceInfo } from '../tonConnectEnvironment';
import { IS_DELEGATING_BOTTOM_SHEET } from '../windowEnvironment';
import {
  CHECKIN_URL,
  SELF_PROTOCOL,
  SELF_UNIVERSAL_URLS,
  TON_PROTOCOL,
  TONCONNECT_PROTOCOL,
  TONCONNECT_PROTOCOL_SELF,
  TONCONNECT_UNIVERSAL_URL,
} from './constants';

import { getIsLandscape, getIsPortrait } from '../../hooks/useDeviceScreen';

type UrlOpener = (url: string) => void | Promise<void>;

enum DeeplinkCommand {
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

function isTonDeeplink(url: string) {
  return url.startsWith(TON_PROTOCOL);
}

export function parseTonDeeplink(value: string | unknown) {
  if (typeof value !== 'string' || !isTonDeeplink(value) || !value.includes('/transfer/')) {
    return undefined;
  }

  try {
    const url = new URL(value);

    const to = url.pathname.replace(/.*\//, '');
    const amount = url.searchParams.get('amount') ?? undefined;
    const comment = url.searchParams.get('text') ?? undefined;
    const binPayload = url.searchParams.get('bin') ?? undefined;

    return {
      to,
      amount: amount ? BigInt(amount) : undefined,
      comment,
      binPayload,
    };
  } catch (err) {
    return undefined;
  }
}

async function processTonDeeplink(url: string, nft?: ApiNft) {
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

function isTonConnectDeeplink(url: string) {
  return url.startsWith(TONCONNECT_PROTOCOL)
    || url.startsWith(TONCONNECT_PROTOCOL_SELF)
    || omitProtocol(url).startsWith(omitProtocol(TONCONNECT_UNIVERSAL_URL));
}

async function processTonConnectDeeplink(url: string, urlOpener?: UrlOpener) {
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

export function isSelfDeeplink(url: string) {
  return url.startsWith(SELF_PROTOCOL)
    || SELF_UNIVERSAL_URLS.some((u) => omitProtocol(url).startsWith(omitProtocol(u)));
}

export function processSelfDeeplink(deeplink: string) {
  try {
    if (deeplink.startsWith(SELF_PROTOCOL)) {
      deeplink = deeplink.replace(SELF_PROTOCOL, `${SELF_UNIVERSAL_URLS[0]}/`);
    }

    const { pathname, searchParams } = new URL(deeplink);
    const command = pathname.split('/').find(Boolean);
    const actions = getActions();
    const global = getGlobal();
    const { isTestnet } = global.settings;
    const isLedger = selectCurrentAccount(global)?.ledger;

    logDebug('Processing deeplink', deeplink);

    switch (command) {
      case DeeplinkCommand.CheckinWithR: {
        const r = pathname.match(/r\/(.*)$/)?.[1];
        const url = `${CHECKIN_URL}${r ? `?r=${r}` : ''}`;
        openUrl(url);
        break;
      }

      case DeeplinkCommand.Swap: {
        if (isTestnet) {
          actions.showError({ error: 'Swap is not supported in Testnet.' });
        } else if (isLedger) {
          actions.showError({ error: 'Swap is not yet supported by Ledger.' });
        } else {
          actions.startSwap({
            tokenInSlug: searchParams.get('in') || TON_TOKEN_SLUG,
            tokenOutSlug: searchParams.get('out') || DEFAULT_SWAP_SECOND_TOKEN_SLUG,
            amountIn: toNumberOrEmptyString(searchParams.get('amount')) || '10',
          });
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
            tokenInSlug: searchParams.get('in') || DEFAULT_CEX_SWAP_SECOND_TOKEN_SLUG,
            tokenOutSlug: searchParams.get('out') || TON_TOKEN_SLUG,
            amountIn: toNumberOrEmptyString(searchParams.get('amount')) || '100',
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

function omitProtocol(url: string) {
  return url.replace(/^https?:\/\//, '');
}

function toNumberOrEmptyString(input?: string | null) {
  return String(Number(input) || '');
}
