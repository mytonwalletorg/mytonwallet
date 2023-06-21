import {
  AppState,
  AuthState, StakingState, TransferState,
} from './types';
import type { GlobalState } from './types';

import {
  ANIMATION_LEVEL_DEFAULT,
  THEME_DEFAULT,
  TOKEN_INFO,
} from '../config';
import { USER_AGENT_LANG_CODE } from '../util/windowEnvironment';

export const STATE_VERSION = 8;

export const INITIAL_STATE: GlobalState = {
  appState: AppState.Auth,

  auth: {
    state: AuthState.none,
  },

  hardware: {},

  currentTransfer: {
    state: TransferState.None,
  },

  currentDappTransfer: {
    state: TransferState.None,
  },

  staking: {
    state: StakingState.None,
  },

  tokenInfo: {
    bySlug: TOKEN_INFO,
  },

  settings: {
    theme: THEME_DEFAULT,
    animationLevel: ANIMATION_LEVEL_DEFAULT,
    areTinyTransfersHidden: true,
    canPlaySounds: true,
    langCode: USER_AGENT_LANG_CODE,
    dapps: [],
  },

  byAccountId: {},

  dialogs: [],
  notifications: [],

  stateVersion: STATE_VERSION,
};
