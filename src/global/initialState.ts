import type { GlobalState } from './types';
import {
  AppState,
  AuthState,
  BiometricsState,
  SettingsState,
  StakingState,
  SwapState,
  TransferState,
} from './types';

import {
  ANIMATION_LEVEL_DEFAULT,
  DEFAULT_SLIPPAGE_VALUE,
  INIT_SWAP_ASSETS,
  THEME_DEFAULT,
  TOKEN_INFO,
} from '../config';
import { IS_IOS_APP, USER_AGENT_LANG_CODE } from '../util/windowEnvironment';

export const STATE_VERSION = 24;

export const INITIAL_STATE: GlobalState = {
  appState: AppState.Auth,

  auth: {
    state: AuthState.none,
  },

  biometrics: {
    state: BiometricsState.None,
  },

  hardware: {},

  currentTransfer: {
    state: TransferState.None,
  },

  currentSwap: {
    state: SwapState.None,
    slippage: DEFAULT_SLIPPAGE_VALUE,
  },

  currentDappTransfer: {
    state: TransferState.None,
  },

  staking: {
    state: StakingState.None,
  },

  stakingInfo: {},

  tokenInfo: {
    bySlug: TOKEN_INFO,
  },

  swapTokenInfo: {
    bySlug: INIT_SWAP_ASSETS,
  },

  tokenPriceHistory: {
    bySlug: {},
  },

  settings: {
    state: SettingsState.Initial,
    theme: THEME_DEFAULT,
    animationLevel: ANIMATION_LEVEL_DEFAULT,
    areTinyTransfersHidden: true,
    canPlaySounds: true,
    langCode: USER_AGENT_LANG_CODE,
    dapps: [],
    byAccountId: {},
    areTokensWithNoCostHidden: true,
    isSortByValueEnabled: true,
  },

  byAccountId: {},

  dialogs: [],
  notifications: [],

  stateVersion: STATE_VERSION,
  restrictions: {
    isLimitedRegion: false,
    isSwapDisabled: IS_IOS_APP,
    isOnRampDisabled: IS_IOS_APP,
  },

  mediaViewer: {},
};
