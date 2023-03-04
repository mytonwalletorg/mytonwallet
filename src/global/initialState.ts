import {
  AuthState, GlobalState, SettingsState, StakingState, TransferState,
} from './types';
import {
  ANIMATION_LEVEL_DEFAULT,
  THEME_DEFAULT,
  TOKEN_INFO,
} from '../config';
import { USER_AGENT_LANG_CODE } from '../util/windowEnvironment';

export const INITIAL_STATE: GlobalState = {
  auth: {
    state: AuthState.none,
  },

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
    state: SettingsState.Initial,
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

  stateVersion: 5, // When incrementing, make changes to migrateCache
};
