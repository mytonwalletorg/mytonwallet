import { typify } from '../lib/teact/teactn';
import {
  ApiHistoryList,
  ApiNetwork,
  ApiNft,
  ApiPoolState,
  ApiStakingHistory,
  ApiToken,
  ApiTransaction,
  ApiTransactionDraftError,
  ApiUpdate,
} from '../api/types';

export type AnimationLevel = 0 | 1 | 2;
export type Theme = 'light' | 'dark' | 'system';
export type NotificationType = {
  icon?: string;
  message: string;
};

export type LangCode = 'en' | 'ru' | 'zh-Hant' | 'zh-Hans';

export interface LangString {
  value?: string;
}

export type LangPack = Record<string, LangString>;

export enum AuthState {
  none,
  creatingWallet,
  createPassword,
  createBackup,
  checkMnemonic,
  importWallet,
  importWalletCreatePassword,
  ready,
}

export enum TransferState {
  None,
  Initial,
  Confirm,
  Password,
  Complete,
}

export enum StakingState {
  None,

  StakeInitial,
  StakePassword,
  StakeComplete,

  UnstakeInitial,
  UnstakePassword,
  UnstakeComplete,
}

export type UserToken = {
  amount: number;
  name: string;
  symbol: string;
  image?: string;
  slug: string;
  price: number;
  decimals: number;
  change24h: number;
  change7d: number;
  change30d: number;
  history24h?: ApiHistoryList;
  history7d?: ApiHistoryList;
  history30d?: ApiHistoryList;
};

export type TokenPeriod = '24h' | '7d' | '30d';

export interface BackupWallet {
  isLoading?: boolean;
  mnemonic?: string[];
  error?: string;
}

export interface Account {
  title?: string;
  address: string;
}

export interface AccountState {
  balances?: {
    bySlug: Record<string, string>;
  };
  transactions?: {
    isLoading?: boolean;
    byTxId: Record<string, ApiTransaction>;
    orderedTxIds?: string[];
  };
  nfts?: {
    byAddress: Record<string, ApiNft>;
    orderedAddresses?: string[];
  };
  backupWallet?: BackupWallet;
  isBackupRequired?: boolean;
  currentTokenSlug?: string;
  currentTransactionId?: string;
  currentTokenPeriod?: TokenPeriod;
  savedAddresses?: Record<string, string>;
  stakingBalance?: number;
  isUnstakeRequested?: boolean;
  poolState?: ApiPoolState;
  stakingHistory?: ApiStakingHistory;
}

export type GlobalState = {
  auth: {
    state: AuthState;
    isLoading?: boolean;
    mnemonic?: string[];
    mnemonicCheckIndexes?: number[];
    accountId?: string;
    address?: string;
    error?: string;
    prevAccountId?: string;
    password?: string;
  };

  currentTransfer: {
    state: TransferState;
    isLoading?: boolean;
    tokenSlug?: string;
    toAddress?: string;
    error?: string;
    amount?: number;
    fee?: string;
    comment?: string;
    promiseId?: string;
    txId?: string;
  };

  currentSignature?: {
    promiseId: string;
    dataHex: string;
    error?: string;
    isSigned?: boolean;
  };

  staking: {
    state: StakingState;
    isLoading?: boolean;
    isUnstaking?: boolean;
    amount?: number;
    fee?: string;
    error?: string;
  };

  accounts?: {
    byId: Record<string, Account>;
    isLoading?: boolean;
    error?: string;
  };

  tokenInfo?: {
    bySlug: Record<string, ApiToken>;
  };

  byAccountId: Record<string, AccountState>;

  settings: {
    theme: Theme;
    animationLevel: AnimationLevel;
    langCode: LangCode;
    areTinyTransfersHidden?: boolean;
    canPlaySounds?: boolean;
    isInvestorViewEnabled?: boolean;
    isTonProxyEnabled?: boolean;
    isTonMagicEnabled?: boolean;
    isTestnet?: boolean;
  };

  dialogs: string[];
  notifications: NotificationType[];
  currentAccountId?: string;
  isAddAccountModalOpen?: boolean;
  isSettingsModalOpen?: boolean;

  stateVersion: number;
};

export interface ActionPayloads {
  // Initial
  init: never;
  initApi: never;
  afterInit: never;
  apiUpdate: ApiUpdate;
  restartAuth: never;
  startCreatingWallet: never;
  afterCheckMnemonic: never;
  skipCheckMnemonic: never;
  restartCheckMnemonicIndexes: never;
  afterCreatePassword: { password: string; isImporting?: boolean };
  startImportingWallet: never;
  afterImportMnemonic: { mnemonic: string[] };
  cleanAuthError: never;

  selectToken: { slug?: string };
  startBackupWallet: { password: string };
  cleanBackupWalletError: never;
  closeBackupWallet: { isMnemonicChecked?: boolean };
  setTransferScreen: { state: TransferState };
  startTransfer: { tokenSlug: string; amount?: number; toAddress?: string; comment?: string };
  changeTransferToken: { tokenSlug: string };
  fetchFee: { tokenSlug: string; amount: number; toAddress: string; comment?: string };
  submitTransferInitial: { tokenSlug: string; amount: number; toAddress: string; comment?: string };
  submitTransferConfirm: never;
  submitTransferPassword: { password: string };
  cleanTransferError: never;
  cancelTransfer: never;
  showDialog: { message: string };
  dismissDialog: never;
  showTxDraftError: { error?: ApiTransactionDraftError };
  showNotification: { message: string; icon?: string };
  dismissNotification: never;
  afterSignIn: never;
  signOut: { isFromAllAccounts?: boolean };
  afterSignOut: { isFromAllAccounts?: boolean };
  addAccount: { isImporting?: boolean; password: string };
  switchAccount: { accountId: string; newNetwork?: ApiNetwork };
  renameAccount: { accountId: string; title: string };
  cleanAccountError: never;

  fetchTransactions: { limit: number; offsetId?: string };
  fetchNfts: never;
  showTransactionInfo: { txId?: string };
  closeTransactionInfo: never;

  submitSignature: { password: string };
  cleanSignatureError: never;
  cancelSignature: never;

  addSavedAddress: { address: string; name: string };
  removeFromSavedAddress: { address: string };

  setCurrentTokenPeriod: { period: TokenPeriod };
  openAddAccountModal: never;
  closeAddAccountModal: never;

  // Staking
  startStaking: { isUnstaking?: boolean };
  setStakingScreen: { state: StakingState };
  submitStakingInitial: { amount?: number; isUnstaking?: boolean };
  submitStakingPassword: { password: string; isUnstaking?: boolean };
  cleanStakingError: never;
  cancelStaking: never;
  fetchPoolState: never;
  fetchStakingState: never;
  fetchStakingHistory: never;

  // Settings
  openSettingsModal: never;
  closeSettingsModal: never;
  setTheme: { theme: Theme };
  setAnimationLevel: { level: AnimationLevel };
  toggleTinyTransfersHidden: { isEnabled?: boolean };
  toggleInvestorView: { isEnabled?: boolean };
  toggleCanPlaySounds: { isEnabled?: boolean };
  toggleTonProxy: { isEnabled: boolean };
  toggleTonMagic: { isEnabled: boolean };
  startChangingNetwork: { network: ApiNetwork };
  changeNetwork: { network: ApiNetwork };
  changeLanguage: { langCode: LangCode };
}

const typed = typify<GlobalState, ActionPayloads>();
export type GlobalActions = ReturnType<typeof typed.getActions>;
