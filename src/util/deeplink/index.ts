import { getActions, getGlobal } from '../../global';

import type { ActionPayloads } from '../../global/types';
import { ActiveTab } from '../../global/types';

import {
  DEFAULT_CEX_SWAP_SECOND_TOKEN_SLUG,
  DEFAULT_SWAP_SECOND_TOKEN_SLUG,
  GIVEAWAY_CHECKIN_URL,
  TONCOIN,
} from '../../config';
import {
  selectAccountTokenBySlug,
  selectCurrentAccount,
  selectCurrentAccountNftByAddress,
  selectTokenByMinterAddress,
} from '../../global/selectors';
import { callApi } from '../../api';
import { isValidAddressOrDomain } from '../isValidAddressOrDomain';
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
  Giveaway = 'giveaway',
  Transfer = 'transfer',
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
    toAddress,
    amount,
    comment,
    binPayload,
    jettonAddress,
    nftAddress,
    stateInit,
  } = params;

  const verifiedAddress = isValidAddressOrDomain(toAddress, 'ton') ? toAddress : undefined;

  const startTransferParams: ActionPayloads['startTransfer'] = {
    isPortrait: getIsPortrait(),
    toAddress: verifiedAddress,
    tokenSlug: TONCOIN.slug,
    amount,
    comment,
    binPayload,
    stateInit,
  };

  if (jettonAddress) {
    const globalToken = jettonAddress
      ? selectTokenByMinterAddress(global, jettonAddress)
      : undefined;

    if (!globalToken) {
      actions.showError({
        error: '$unknown_token_address',
      });
      return;
    }
    const accountToken = selectAccountTokenBySlug(global, globalToken.slug);

    if (!accountToken) {
      actions.showError({
        error: '$dont_have_required_token',
      });
      return;
    }

    startTransferParams.tokenSlug = globalToken.slug;
  }

  if (nftAddress) {
    const accountNft = selectCurrentAccountNftByAddress(global, nftAddress);

    if (!accountNft) {
      actions.showError({
        error: '$dont_have_required_nft',
      });
      return;
    }

    startTransferParams.nfts = [accountNft];
  }

  actions.startTransfer(omitUndefined(startTransferParams));

  if (getIsLandscape()) {
    actions.setLandscapeActionsActiveTabIndex({ index: ActiveTab.Transfer });
  }
}

export function parseTonDeeplink(value?: string) {
  if (typeof value !== 'string' || !isTonDeeplink(value) || !value.includes('/transfer/')) {
    return undefined;
  }

  try {
    // In some browsers URL module may handle non-standard protocols incorrectly
    const adaptedDeeplink = value.replace(TON_PROTOCOL, 'https://');
    const url = new URL(adaptedDeeplink);

    const toAddress = url.pathname.replace(/\//g, '');
    const amount = getDeeplinkSearchParam(url, 'amount');
    const comment = getDeeplinkSearchParam(url, 'text');
    const binPayload = getDeeplinkSearchParam(url, 'bin');
    const jettonAddress = getDeeplinkSearchParam(url, 'jetton');
    const nftAddress = getDeeplinkSearchParam(url, 'nft');
    const stateInit = getDeeplinkSearchParam(url, 'init') || getDeeplinkSearchParam(url, 'stateInit');

    return {
      toAddress,
      amount: amount ? BigInt(amount) : undefined,
      comment,
      jettonAddress,
      nftAddress,
      binPayload: binPayload ? replaceAllSpacesWithPlus(binPayload) : undefined,
      stateInit: stateInit ? replaceAllSpacesWithPlus(stateInit) : undefined,
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
  url = forceHttpsProtocol(url);

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

      case DeeplinkCommand.Giveaway: {
        const giveawayId = pathname.match(/giveaway\/([^/]+)/)?.[1];
        const url = `${GIVEAWAY_CHECKIN_URL}${giveawayId ? `?giveawayId=${giveawayId}` : ''}`;
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
            tokenInSlug: searchParams.get('in') || TONCOIN.slug,
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
            tokenOutSlug: searchParams.get('out') || TONCOIN.slug,
            amountIn: toNumberOrEmptyString(searchParams.get('amount')) || '100',
          });
        }
        break;
      }

      case DeeplinkCommand.BuyWithCard: {
        if (isTestnet) {
          actions.showError({ error: 'Buying with card is not supported in Testnet.' });
        } else {
          actions.openOnRampWidgetModal({ chain: 'ton' });
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

      case DeeplinkCommand.Transfer: {
        let tonDeeplink = forceHttpsProtocol(deeplink);
        SELF_UNIVERSAL_URLS.forEach((prefix) => {
          if (tonDeeplink.startsWith(prefix)) {
            tonDeeplink = tonDeeplink.replace(`${prefix}/`, TON_PROTOCOL);
          }
        });

        processTonDeeplink(tonDeeplink);
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

function forceHttpsProtocol(url: string) {
  return url.replace(/^http:\/\//, 'https://');
}

function toNumberOrEmptyString(input?: string | null) {
  return String(Number(input) || '');
}

function replaceAllSpacesWithPlus(value: string) {
  return value.replace(/ /g, '+');
}

function getDeeplinkSearchParam(url: URL, param: string) {
  return url.searchParams.get(param) ?? undefined;
}
