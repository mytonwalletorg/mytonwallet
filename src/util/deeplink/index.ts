import { getActions, getGlobal } from '../../global';

import { ActiveTab } from '../../global/types';

import { DEFAULT_CEX_SWAP_SECOND_TOKEN_SLUG, DEFAULT_SWAP_SECOND_TOKEN_SLUG, TONCOIN_SLUG } from '../../config';
import { selectCurrentAccount } from '../../global/selectors';
import { callApi } from '../../api';
import { isTonAddressOrDomain } from '../isTonAddressOrDomain';
import { omitUndefined } from '../iteratees';
import { logDebug, logDebugError } from '../logs';
import { openUrl } from '../openUrl';
import { waitRender } from '../renderPromise';
import { tonConnectGetDeviceInfo } from '../tonConnectEnvironment';
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

enum DeeplinkCommand {
  CheckinWithR = 'r',
  Swap = 'swap',
  BuyWithCrypto = 'buy-with-crypto',
  BuyWithCard = 'buy-with-card',
  Stake = 'stake',
}

let urlAfterSignIn: string | undefined;

export function processDeeplinkAfterSignIn() {
  if (!urlAfterSignIn) return;

  processDeeplink(urlAfterSignIn);

  urlAfterSignIn = undefined;
}

export function openDeeplinkOrUrl(url: string, isExternal = false, isFromInAppBrowser = false) {
  if (isTonDeeplink(url) || isTonConnectDeeplink(url) || isSelfDeeplink(url)) {
    processDeeplink(url, isFromInAppBrowser);
  } else {
    void openUrl(url, isExternal);
  }
}

export function processDeeplink(url: string, isFromInAppBrowser = false) {
  if (!getGlobal().currentAccountId) {
    urlAfterSignIn = url;
  }

  if (isTonConnectDeeplink(url)) {
    void processTonConnectDeeplink(url, isFromInAppBrowser);
  } else if (isSelfDeeplink(url)) {
    processSelfDeeplink(url);
  } else {
    void processTonDeeplink(url);
  }
}

export function isTonDeeplink(url: string) {
  return url.startsWith(TON_PROTOCOL);
}

async function processTonDeeplink(url: string) {
  const params = parseTonDeeplink(url);
  if (!params) return;

  await waitRender();

  const actions = getActions();
  const global = getGlobal();
  if (!global.currentAccountId) {
    return;
  }

  const {
    toAddress, amount, comment, binPayload,
  } = params;

  const verifiedAddress = isTonAddressOrDomain(toAddress) ? toAddress : undefined;

  actions.startTransfer(omitUndefined({
    isPortrait: getIsPortrait(),
    tokenSlug: TONCOIN_SLUG,
    toAddress: verifiedAddress,
    amount,
    comment,
    binPayload,
  }));

  if (getIsLandscape()) {
    actions.setLandscapeActionsActiveTabIndex({ index: ActiveTab.Transfer });
  }
}

export function parseTonDeeplink(value: string | unknown) {
  if (typeof value !== 'string' || !isTonDeeplink(value) || !value.includes('/transfer/')) {
    return undefined;
  }

  try {
    const url = new URL(value);

    const toAddress = url.pathname.replace(/.*\//, '');
    const amount = url.searchParams.get('amount') ?? undefined;
    const comment = url.searchParams.get('text') ?? undefined;
    const binPayload = url.searchParams.get('bin') ?? undefined;

    return {
      toAddress,
      amount: amount ? BigInt(amount) : undefined,
      comment,
      binPayload,
    };
  } catch (err) {
    return undefined;
  }
}

function isTonConnectDeeplink(url: string) {
  return url.startsWith(TONCONNECT_PROTOCOL)
    || url.startsWith(TONCONNECT_PROTOCOL_SELF)
    || omitProtocol(url).startsWith(omitProtocol(TONCONNECT_UNIVERSAL_URL));
}

async function processTonConnectDeeplink(url: string, isFromInAppBrowser = false) {
  if (!isTonConnectDeeplink(url)) {
    return;
  }

  const { openLoadingOverlay, closeLoadingOverlay } = getActions();

  openLoadingOverlay();

  const deviceInfo = tonConnectGetDeviceInfo();
  const returnUrl = await callApi('startSseConnection', {
    url,
    deviceInfo,
    isFromInAppBrowser,
  });

  closeLoadingOverlay();

  if (returnUrl) {
    openUrl(returnUrl, !isFromInAppBrowser);
  }
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
            tokenInSlug: searchParams.get('in') || TONCOIN_SLUG,
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
            tokenOutSlug: searchParams.get('out') || TONCOIN_SLUG,
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
