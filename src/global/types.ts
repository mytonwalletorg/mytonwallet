import type { ApiTonConnectProof } from '../api/tonConnect/types';
import type {
  ApiBackendStakingState,
  ApiDapp,
  ApiDappPermissions,
  ApiDappTransaction,
  ApiHistoryList,
  ApiLedgerDriver,
  ApiNetwork,
  ApiNft,
  ApiParsedPayload,
  ApiPoolState,
  ApiToken,
  ApiTransaction,
  ApiTransactionDraftError,
  ApiUpdate,
} from '../api/types';
import type { LedgerWalletInfo } from '../util/ledger/types';

export type AnimationLevel = 0 | 1 | 2;
export type Theme = 'light' | 'dark' | 'system';
export type NotificationType = {
  icon?: string;
  message: string;
};

export type LangCode = 'en' | 'es' | 'ru' | 'zh-Hant' | 'zh-Hans';

export interface LangItem {
  langCode: LangCode;
  name: string;
  nativeName: string;
  rtl: boolean;
}

export interface LangString {
  value?: string;
}

export type LangPack = Record<string, LangString>;

export type AuthMethod = 'createAccount' | 'importMnemonic' | 'importHardwareWallet';

export enum AppState {
  Auth,
  Main,
  Settings,
  Ledger,
  Inactive,
}

export enum AuthState {
  none,
  creatingWallet,
  createPassword,
  createBackup,
  importWallet,
  importWalletCreatePassword,
  ready,
  about,
}

export enum TransferState {
  None,
  Initial,
  Confirm,
  Password,

  ConnectHardware,
  ConfirmHardware,

  Complete,
}

export enum DappConnectState {
  Info,
  Password,
  ConnectHardware,
  ConfirmHardware,
}

export enum HardwareConnectState {
  Connect,
  Connecting,
  Failed,
  Connected,
  WaitingForBrowser,
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

export interface Account {
  title?: string;
  address: string;
  isHardware?: boolean;
  ledger?: {
    index: number;
    driver: ApiLedgerDriver;
  };
}

export interface AccountState {
  balances?: {
    bySlug: Record<string, string>;
  };
  transactions?: {
    isLoading?: boolean;
    byTxId: Record<string, ApiTransaction>;
    txIdsBySlug?: Record<string, string[]>;
    newestTransactionsBySlug?: Record<string, ApiTransaction>;
  };
  nfts?: {
    byAddress: Record<string, ApiNft>;
    orderedAddresses?: string[];
  };
  isBackupRequired?: boolean;
  activeDappOrigin?: string;
  currentTokenSlug?: string;
  currentTransactionId?: string;
  currentTokenPeriod?: TokenPeriod;
  savedAddresses?: Record<string, string>;
  stakingBalance?: number;
  isUnstakeRequested?: boolean;
  poolState?: ApiPoolState;
  stakingHistory?: ApiBackendStakingState;
}

export type GlobalState = {
  appState: AppState;

  auth: {
    state: AuthState;
    method?: AuthMethod;
    isLoading?: boolean;
    mnemonic?: string[];
    mnemonicCheckIndexes?: number[];
    accountId?: string;
    address?: string;
    error?: string;
    password?: string;
  };

  hardware: {
    hardwareState?: HardwareConnectState;
    hardwareWallets?: LedgerWalletInfo[];
    hardwareSelectedIndices?: number[];
    isRemoteTab?: boolean;
    isLedgerConnected?: boolean;
    isTonAppConnected?: boolean;
  };

  currentTransfer: {
    state: TransferState;
    isLoading?: boolean;
    tokenSlug?: string;
    toAddress?: string;
    toAddressName?: string;
    error?: string;
    amount?: number;
    fee?: string;
    comment?: string;
    promiseId?: string;
    txId?: string;
    rawPayload?: string;
    parsedPayload?: ApiParsedPayload;
    stateInit?: string;
    shouldEncrypt?: boolean;
  };

  currentSignature?: {
    promiseId: string;
    dataHex: string;
    error?: string;
    isSigned?: boolean;
  };

  currentDappTransfer: {
    state: TransferState;
    promiseId?: string;
    isLoading?: boolean;
    transactions?: ApiDappTransaction[];
    viewTransactionOnIdx?: number;
    fee?: string;
    dapp?: ApiDapp;
    error?: string;
  };

  dappConnectRequest?: {
    state: DappConnectState;
    promiseId?: string;
    accountId?: string;
    dapp: ApiDapp;
    permissions?: ApiDappPermissions;
    proof?: ApiTonConnectProof;
    error?: string;
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
    dapps: ApiDapp[];
    areTinyTransfersHidden?: boolean;
    canPlaySounds?: boolean;
    isInvestorViewEnabled?: boolean;
    isTonProxyEnabled?: boolean;
    isTonMagicEnabled?: boolean;
    isDeeplinkHookEnabled?: boolean;
    isTestnet?: boolean;
    isSecurityWarningHidden?: boolean;
  };

  dialogs: string[];
  notifications: NotificationType[];
  currentAccountId?: string;
  isAddAccountModalOpen?: boolean;
  isBackupWalletModalOpen?: boolean;
  landscapeActionsActiveTabIndex?: 0 | 1 | 2;
  isHardwareModalOpen?: boolean;
  areSettingsOpen?: boolean;

  stateVersion: number;
};

export interface ActionPayloads {
  // Initial
  init: undefined;
  initApi: undefined;
  afterInit: undefined;
  apiUpdate: ApiUpdate;
  restartAuth: undefined;
  startCreatingWallet: undefined;
  afterCheckMnemonic: undefined;
  skipCheckMnemonic: undefined;
  restartCheckMnemonicIndexes: undefined;
  afterCreatePassword: { password: string };
  startImportingWallet: undefined;
  afterImportMnemonic: { mnemonic: string[] };
  startImportingHardwareWallet: { driver: ApiLedgerDriver };
  cleanAuthError: undefined;
  openAbout: undefined;
  closeAbout: undefined;
  connectHardwareWallet: undefined;
  createHardwareAccounts: undefined;
  createAccount: { password: string; isImporting: boolean };
  afterSelectHardwareWallets: { hardwareSelectedIndices: number[] };

  selectToken: { slug?: string } | undefined;
  openBackupWalletModal: undefined;
  closeBackupWalletModal: undefined;
  setIsBackupRequired: { isMnemonicChecked: boolean };
  openHardwareWalletModal: undefined;
  closeHardwareWalletModal: undefined;
  resetHardwareWalletConnect: undefined;
  setTransferScreen: { state: TransferState };
  startTransfer: { tokenSlug?: string; amount?: number; toAddress?: string; comment?: string } | undefined;
  changeTransferToken: { tokenSlug: string };
  fetchFee: {
    tokenSlug: string;
    amount: number;
    toAddress: string;
    comment?: string;
    shouldEncrypt?: boolean;
  };
  submitTransferInitial: {
    tokenSlug: string;
    amount: number;
    toAddress: string;
    comment?: string;
    shouldEncrypt?: boolean;
  };
  submitTransferConfirm: undefined;
  submitTransferPassword: { password: string };
  submitTransferHardware: undefined;
  clearTransferError: undefined;
  cancelTransfer: undefined;
  showDialog: { message: string };
  dismissDialog: undefined;
  showError: { error?: string };
  showTxDraftError: { error?: ApiTransactionDraftError } | undefined;
  showNotification: { message: string; icon?: string };
  dismissNotification: undefined;
  initLedgerPage: undefined;
  afterSignIn: undefined;
  signOut: { isFromAllAccounts?: boolean } | undefined;
  cancelCaching: undefined;
  afterSignOut: { isFromAllAccounts?: boolean } | undefined;
  addAccount: { method: AuthMethod; password: string };
  switchAccount: { accountId: string; newNetwork?: ApiNetwork };
  renameAccount: { accountId: string; title: string };
  clearAccountError: undefined;
  validatePassword: { password: string };

  fetchTokenTransactions: { limit: number; slug: string; offsetId?: string };
  fetchAllTransactions: { limit: number };
  fetchNfts: undefined;
  showTransactionInfo: { txId?: string } | undefined;
  closeTransactionInfo: undefined;

  submitSignature: { password: string };
  clearSignatureError: undefined;
  cancelSignature: undefined;

  addSavedAddress: { address: string; name: string };
  removeFromSavedAddress: { address: string };

  setCurrentTokenPeriod: { period: TokenPeriod };
  openAddAccountModal: undefined;
  closeAddAccountModal: undefined;

  setLandscapeActionsActiveTabIndex: { index: 0 | 1 | 2 };

  // Staking
  startStaking: { isUnstaking?: boolean } | undefined;
  setStakingScreen: { state: StakingState };
  submitStakingInitial: { amount?: number; isUnstaking?: boolean } | undefined;
  submitStakingPassword: { password: string; isUnstaking?: boolean };
  clearStakingError: undefined;
  cancelStaking: undefined;
  fetchStakingState: undefined;
  fetchBackendStakingState: undefined;
  fetchStakingFee: { amount: number };

  // Settings
  openSettings: undefined;
  closeSettings: undefined;
  setTheme: { theme: Theme };
  setAnimationLevel: { level: AnimationLevel };
  toggleTinyTransfersHidden: { isEnabled?: boolean } | undefined;
  toggleInvestorView: { isEnabled?: boolean } | undefined;
  toggleCanPlaySounds: { isEnabled?: boolean } | undefined;
  toggleTonProxy: { isEnabled: boolean };
  toggleTonMagic: { isEnabled: boolean };
  toggleDeeplinkHook: { isEnabled: boolean };
  startChangingNetwork: { network: ApiNetwork };
  changeNetwork: { network: ApiNetwork };
  changeLanguage: { langCode: LangCode };
  closeSecurityWarning: undefined;

  // TON Connect
  submitDappConnectRequestConfirm: { additionalAccountIds: string[]; password?: string };
  submitDappConnectRequestConfirmHardware: { additionalAccountIds: string[] };
  clearDappConnectRequestError: undefined;
  cancelDappConnectRequestConfirm: undefined;
  setDappConnectRequestState: { state: DappConnectState };
  showDappTransaction: { transactionIdx: number };
  setDappTransferScreen: { state: TransferState };
  clearDappTransferError: undefined;
  submitDappTransferConfirm: undefined;
  submitDappTransferPassword: { password: string };
  submitDappTransferHardware: undefined;
  cancelDappTransfer: undefined;

  getDapps: undefined;
  deleteAllDapps: undefined;
  deleteDapp: { origin: string };
}
