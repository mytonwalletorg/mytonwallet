import type { ApiCurrencyRates } from '../api/types';
import type { GlobalState } from './types';
import {
  AppState,
  AuthState,
  BiometricsState,
  DomainLinkingState,
  DomainRenewalState,
  SettingsState,
  SignDataState,
  StakingState,
  TransactionInfoState,
  TransferState,
  WalletConnectPayState,
} from './types';

import {
  ANIMATION_LEVEL_DEFAULT,
  CURRENCIES,
  DEFAULT_AUTOLOCK_OPTION,
  DEFAULT_PRICE_CURRENCY,
  DEFAULT_STAKING_STATE,
  DEFAULT_TRANSFER_TOKEN_SLUG,
  THEME_DEFAULT,
} from '../config';
import { getTokenInfo } from '../util/chain';
import { mapValues } from '../util/iteratees';
import { IS_IOS_APP, USER_AGENT_LANG_CODE } from '../util/windowEnvironment';

// First persisted-state schema for ION Wallet. Increment when adding a cache migration.
export const STATE_VERSION = 1;

export const INITIAL_STATE: GlobalState = {
  appState: AppState.Auth,

  auth: {
    state: AuthState.none,
  },

  biometrics: {
    state: BiometricsState.None,
  },

  currentTransfer: {
    state: TransferState.None,
    tokenSlug: DEFAULT_TRANSFER_TOKEN_SLUG,
  },

  currentDomainRenewal: {
    state: DomainRenewalState.None,
  },

  currentDomainLinking: {
    state: DomainLinkingState.None,
  },

  currentDappTransfer: {
    state: TransferState.None,
  },

  currentDappSignData: {
    state: SignDataState.None,
  },

  currentWalletConnectPay: {
    state: WalletConnectPayState.None,
  },

  currentStaking: {
    state: StakingState.None,
  },

  stakingDefault: DEFAULT_STAKING_STATE,

  tokenInfo: {
    bySlug: getTokenInfo(),
  },

  tokenPriceHistory: {
    bySlug: {},
  },

  settings: {
    state: SettingsState.Initial,
    theme: THEME_DEFAULT,
    animationLevel: ANIMATION_LEVEL_DEFAULT,
    areTinyTransfersHidden: true,
    areUnverifiedNftsHidden: true,
    areTokenNamesLocalized: true,
    canPlaySounds: true,
    langCode: USER_AGENT_LANG_CODE,
    langSource: 'system',
    byAccountId: {},
    areTokensWithNoCostHidden: true,
    autolockValue: DEFAULT_AUTOLOCK_OPTION,
    baseCurrency: DEFAULT_PRICE_CURRENCY,
  },

  byAccountId: {},

  dialogs: [],
  toasts: [],

  stateVersion: STATE_VERSION,
  currentTemporaryViewAccountId: undefined,

  restrictions: {
    isLimitedRegion: false,
    isNftBuyingDisabled: IS_IOS_APP,
  },

  mediaViewer: {},

  currentTransactionInfo: {
    state: TransactionInfoState.None,
  },

  pushNotifications: {
    enabledAccounts: [],
  },

  currencyRates: mapValues(CURRENCIES, (currency) => currency.fallbackRate) as ApiCurrencyRates,
};
