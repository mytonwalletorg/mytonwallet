import { AuthState, GlobalState, TransferState } from './types';
import { ANIMATION_LEVEL_DEFAULT, TOKEN_INFO } from '../config';

export const INITIAL_STATE: GlobalState = {
  auth: {
    state: AuthState.none,
  },

  currentTransfer: {
    state: TransferState.None,
  },

  tokenInfo: {
    bySlug: TOKEN_INFO,
  },

  settings: {
    animationLevel: ANIMATION_LEVEL_DEFAULT,
  },

  backupWallet: {},

  dialogs: [],
  notifications: [],
};
