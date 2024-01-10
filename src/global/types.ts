import type { ApiTonConnectProof } from '../api/tonConnect/types';
import type {
  ApiActivity,
  ApiAnyDisplayError,
  ApiBaseCurrency,
  ApiDapp,
  ApiDappPermissions,
  ApiDappTransaction,
  ApiHistoryList,
  ApiLedgerDriver,
  ApiNetwork,
  ApiNft,
  ApiParsedPayload,
  ApiStakingHistory,
  ApiStakingType,
  ApiSwapAsset,
  ApiToken,
  ApiTransaction,
  ApiTransactionActivity,
  ApiUpdate,
  ApiUpdateDappConnect,
  ApiUpdateDappSendTransactions,
} from '../api/types';
import type { AuthConfig } from '../util/authApi/types';
import type { LedgerWalletInfo } from '../util/ledger/types';

export type AnimationLevel = 0 | 1 | 2;
export type Theme = 'light' | 'dark' | 'system';
export type NotificationType = {
  icon?: string;
  message: string;
};

export type LangCode = 'en' | 'es' | 'ru' | 'zh-Hant' | 'zh-Hans' | 'tr' | 'de';

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
  createPin,
  confirmPin,
  createBiometrics,
  confirmBiometrics,
  createNativeBiometrics,
  createPassword,
  createBackup,
  disclaimerAndBackup,
  importWallet,
  importWalletCreatePin,
  importWalletConfirmPin,
  importWalletCreateNativeBiometrics,
  importWalletCreateBiometrics,
  importWalletConfirmBiometrics,
  importWalletCreatePassword,
  disclaimer,
  ready,
  about,
}

export enum BiometricsState {
  None,
  TurnOnPasswordConfirmation,
  TurnOnRegistration,
  TurnOnVerification,
  TurnOnComplete,
  TurnOffWarning,
  TurnOffBiometricConfirmation,
  TurnOffCreatePassword,
  TurnOffComplete,
}

export enum TransferState {
  None,
  WarningHardware,
  Initial,
  Confirm,
  Password,
  ConnectHardware,
  ConfirmHardware,
  Complete,
}

export enum SwapState {
  None,
  Initial,
  Blockchain,
  WaitTokens,
  Password,
  ConnectHardware,
  ConfirmHardware,
  Complete,
  SelectTokenFrom,
  SelectTokenTo,
}

export enum SwapFeeSource {
  In,
  Out,
}

export enum SwapInputSource {
  In,
  Out,
}

export enum SwapErrorType {
  InvalidPair,
  NotEnoughLiquidity,

  ChangellyMinSwap,
  ChangellyMaxSwap,
}

export enum SwapType {
  OnChain,
  CrosschainFromTon,
  CrosschainToTon,
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
  ConnectedWithSeveralWallets,
  ConnectedWithSingleWallet,
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

export enum SettingsState {
  Initial,
  Appearance,
  Assets,
  Dapps,
  Language,
  About,
  Disclaimer,
  NativeBiometricsTurnOn,
  SelectTokenList,
}

export enum ActiveTab {
  Receive,
  Transfer,
  Swap,
  Stake,
}

export enum ContentTab {
  Assets,
  Activity,
  Nft,
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
  isDisabled?: boolean;
  canSwap?: boolean;
  keywords?: string[];
  cmcSlug?: string;
};

export type UserSwapToken = {
  blockchain: string;
  isPopular: boolean;
  contract?: string;
} & Omit<UserToken, 'price' | 'change24h' | 'change7d' | 'change30d' | 'history24h' | 'history7d' | 'history30d'>;

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

export interface AssetPairs {
  [slug: string]: {
    isReverseProhibited?: boolean;
  };
}

export interface AccountState {
  balances?: {
    bySlug: Record<string, string>;
  };
  activities?: {
    isLoading?: boolean;
    byId: Record<string, ApiActivity>;
    idsBySlug?: Record<string, string[]>;
    newestTransactionsBySlug?: Record<string, ApiTransaction>;
    isMainHistoryEndReached?: boolean;
    isHistoryEndReachedBySlug?: Record<string, boolean>;
    localTransactions?: ApiTransactionActivity[];
  };
  nfts?: {
    byAddress: Record<string, ApiNft>;
    orderedAddresses?: string[];
  };
  isBackupRequired?: boolean;
  activeDappOrigin?: string;
  currentTokenSlug?: string;
  currentActivityId?: string;
  currentTokenPeriod?: TokenPeriod;
  savedAddresses?: Record<string, string>;
  activeContentTab?: ContentTab;
  landscapeActionsActiveTabIndex?: ActiveTab;

  // Staking
  staking?: {
    type: ApiStakingType;
    balance: number;
    apy: number;
    isUnstakeRequested: boolean;
    start: number;
    end: number;
    totalProfit: number;
    // liquid
    unstakeRequestedAmount?: number;
    tokenBalance?: number;
    isInstantUnstakeRequested?: boolean;
  };
  stakingHistory?: ApiStakingHistory;

  isLongUnstakeRequested?: boolean;
}

export interface AccountSettings {
  orderedSlugs?: string[];
  exceptionSlugs?: string[];
  deletedSlugs?: string[];
}

export type GlobalState = {
  DEBUG_capturedId?: number;

  appState: AppState;

  auth: {
    state: AuthState;
    biometricsStep?: 1 | 2;
    method?: AuthMethod;
    isLoading?: boolean;
    mnemonic?: string[];
    mnemonicCheckIndexes?: number[];
    accountId?: string;
    address?: string;
    error?: string;
    password?: string;
    isBackupModalOpen?: boolean;
  };

  biometrics: {
    state: BiometricsState;
    error?: string;
    password?: string;
  };

  nativeBiometricsError?: string;

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
    resolvedAddress?: string;
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
    isToNewAddress?: boolean;
  };

  currentSwap: {
    state: SwapState;
    slippage: number;
    tokenInSlug?: string;
    tokenOutSlug?: string;
    amountIn?: number;
    amountOut?: number;
    amountOutMin?: string;
    transactionFee?: string;
    networkFee?: number;
    realNetworkFee?: number;
    swapFee?: string;
    priceImpact?: number;
    dexLabel?: string;
    activityId?: string;
    error?: string;
    errorType?: SwapErrorType;
    isLoading?: boolean;
    shouldEstimate?: boolean;
    isEstimating?: boolean;
    inputSource?: SwapInputSource;
    swapType?: SwapType;
    feeSource?: SwapFeeSource;
    toAddress?: string;
    payinAddress?: string;
    pairs?: {
      bySlug: Record<string, AssetPairs>;
    };
    limits?: {
      fromMin?: string;
      fromMax?: string;
    };
    isSettingsModalOpen?: boolean;
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
    tokenAmount?: string;
    fee?: string;
    error?: string;
    type?: ApiStakingType;
  };

  stakingInfo: {
    liquid?: {
      instantAvailable: string;
    };
  };

  accounts?: {
    byId: Record<string, Account>;
    isLoading?: boolean;
    error?: string;
  };

  tokenInfo: {
    bySlug: Record<string, ApiToken>;
  };

  swapTokenInfo: {
    bySlug: Record<string, ApiSwapAsset>;
  };

  byAccountId: Record<string, AccountState>;

  settings: {
    state: SettingsState;
    theme: Theme;
    animationLevel: AnimationLevel;
    langCode: LangCode;
    dapps: ApiDapp[];
    byAccountId: Record<string, AccountSettings>;
    areTinyTransfersHidden?: boolean;
    canPlaySounds?: boolean;
    isInvestorViewEnabled?: boolean;
    isTonProxyEnabled?: boolean;
    isTonMagicEnabled?: boolean;
    isDeeplinkHookEnabled?: boolean;
    isPasswordNumeric?: boolean; // Backwards compatibility for non-numeric passwords from older versions
    isTestnet?: boolean;
    isSecurityWarningHidden?: boolean;
    areTokensWithNoBalanceHidden: boolean;
    areTokensWithNoPriceHidden: boolean;
    isSortByValueEnabled?: boolean;
    importToken?: {
      isLoading?: boolean;
      token?: UserToken | UserSwapToken;
    };
    authConfig?: AuthConfig;
    baseCurrency?: ApiBaseCurrency;
    isLimitedRegion?: boolean;
  };

  dialogs: string[];
  notifications: NotificationType[];
  currentAccountId?: string;
  isAddAccountModalOpen?: boolean;
  isBackupWalletModalOpen?: boolean;
  isHardwareModalOpen?: boolean;
  isStakingInfoModalOpen?: boolean;
  isQrScannerOpen?: boolean;
  areSettingsOpen?: boolean;
  isAppUpdateAvailable?: boolean;
  confettiRequestedAt?: number;
  isPinAccepted?: boolean;

  stateVersion: number;
  restrictions: {
    isLimitedRegion: boolean;
    isSwapDisabled: boolean;
  };
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
  cancelDisclaimer: undefined;
  afterCreatePassword: { password: string; isPasswordNumeric?: boolean };
  startCreatingBiometrics: undefined;
  afterCreateBiometrics: undefined;
  skipCreateBiometrics: undefined;
  cancelCreateBiometrics: undefined;
  afterCreateNativeBiometrics: undefined;
  skipCreateNativeBiometrics: undefined;
  createPin: { pin: string; isImporting: boolean };
  confirmPin: { isImporting: boolean };
  cancelConfirmPin: { isImporting: boolean };
  startImportingWallet: undefined;
  afterImportMnemonic: { mnemonic: string[] };
  startImportingHardwareWallet: { driver: ApiLedgerDriver };
  confirmDisclaimer: undefined;
  afterConfirmDisclaimer: undefined;
  cleanAuthError: undefined;
  openAbout: undefined;
  closeAbout: undefined;
  openAuthBackupWalletModal: undefined;
  closeAuthBackupWalletModal: { isBackupCreated?: boolean } | undefined;
  initializeHardwareWalletConnection: undefined;
  connectHardwareWallet: undefined;
  createHardwareAccounts: undefined;
  loadMoreHardwareWallets: { lastIndex: number };
  createAccount: { password: string; isImporting: boolean; isPasswordNumeric?: boolean };
  afterSelectHardwareWallets: { hardwareSelectedIndices: number[] };
  resetApiSettings: { areAllDisabled?: boolean } | undefined;
  checkAppVersion: undefined;

  selectToken: { slug?: string } | undefined;
  openBackupWalletModal: undefined;
  closeBackupWalletModal: undefined;
  setIsBackupRequired: { isMnemonicChecked: boolean };
  openHardwareWalletModal: undefined;
  closeHardwareWalletModal: undefined;
  resetHardwareWalletConnect: undefined;
  setTransferScreen: { state: TransferState };
  setTransferAmount: { amount?: number };
  setTransferToAddress: { toAddress?: string };
  setTransferComment: { comment?: string };
  setTransferShouldEncrypt: { shouldEncrypt?: boolean };
  startTransfer: {
    isPortrait?: boolean;
    tokenSlug?: string;
    amount?: number;
    toAddress?: string;
    comment?: string;
  } | undefined;
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
  cancelTransfer: { shouldReset?: boolean } | undefined;
  showDialog: { message: string };
  dismissDialog: undefined;
  showError: { error?: ApiAnyDisplayError | string };
  showNotification: { message: string; icon?: string };
  dismissNotification: undefined;
  initLedgerPage: undefined;
  afterSignIn: { isFirstLogin: boolean } | undefined;
  signOut: { isFromAllAccounts?: boolean } | undefined;
  cancelCaching: undefined;
  afterSignOut: { isFromAllAccounts?: boolean } | undefined;
  addAccount: { method: AuthMethod; password: string };
  addAccount2: { method: AuthMethod; password: string };
  switchAccount: { accountId: string; newNetwork?: ApiNetwork };
  renameAccount: { accountId: string; title: string };
  clearAccountError: undefined;
  validatePassword: { password: string };
  verifyHardwareAddress: undefined;

  fetchTokenTransactions: { limit: number; slug: string; shouldLoadWithBudget?: boolean };
  fetchAllTransactions: { limit: number; shouldLoadWithBudget?: boolean };
  resetIsHistoryEndReached: { slug: string } | undefined;
  fetchNfts: undefined;
  showActivityInfo: { id: string };
  closeActivityInfo: { id: string };

  submitSignature: { password: string };
  clearSignatureError: undefined;
  cancelSignature: undefined;

  addSavedAddress: { address: string; name: string };
  removeFromSavedAddress: { address: string };

  setCurrentTokenPeriod: { period: TokenPeriod };
  openAddAccountModal: undefined;
  closeAddAccountModal: undefined;

  setLandscapeActionsActiveTabIndex: { index: ActiveTab };
  setActiveContentTab: { tab: ContentTab };

  requestConfetti: undefined;
  setIsPinAccepted: undefined;
  clearIsPinAccepted: undefined;

  openQrScanner: undefined;
  closeQrScanner: undefined;
  openDeeplink: { url: string };

  // Staking
  startStaking: { isUnstaking?: boolean } | undefined;
  setStakingScreen: { state: StakingState };
  submitStakingInitial: { amount?: number; isUnstaking?: boolean } | undefined;
  submitStakingPassword: { password: string; isUnstaking?: boolean };
  clearStakingError: undefined;
  cancelStaking: undefined;
  fetchStakingHistory: { limit?: number; offset?: number } | undefined;
  fetchStakingFee: { amount: number };
  openStakingInfo: undefined;
  closeStakingInfo: undefined;

  // Settings
  openSettings: undefined;
  openSettingsWithState: { state: SettingsState };
  setSettingsState: { state?: SettingsState };
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
  toggleTokensWithNoBalance: { isEnabled: boolean };
  toggleTokensWithNoPrice: { isEnabled: boolean };
  toggleSortByValue: { isEnabled: boolean };
  initTokensOrder: undefined;
  updateDeletionListForActiveTokens: { accountId: string } | undefined;
  sortTokens: { orderedSlugs: string[] };
  toggleExceptionToken: { slug: string };
  addToken: { token: UserToken };
  deleteToken: { slug: string };
  importToken: { address: string; isSwap?: boolean };
  resetImportToken: undefined;
  closeBiometricSettings: undefined;
  openBiometricsTurnOn: undefined;
  openBiometricsTurnOffWarning: undefined;
  openBiometricsTurnOff: undefined;
  enableBiometrics: { password: string };
  disableBiometrics: { password: string; isPasswordNumeric?: boolean };
  enableNativeBiometrics: { password: string };
  disableNativeBiometrics: undefined;
  changeBaseCurrency: { currency: ApiBaseCurrency };
  clearNativeBiometricsError: undefined;

  // TON Connect
  submitDappConnectRequestConfirm: { accountId: string; password?: string };
  submitDappConnectRequestConfirmHardware: { accountId: string };
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

  apiUpdateDappConnect: ApiUpdateDappConnect;
  apiUpdateDappSendTransaction: ApiUpdateDappSendTransactions;

  // Swap
  submitSwap: { password: string };
  startSwap: { tokenInSlug?: string; tokenOutSlug?: string; amountIn?: number; isPortrait?: boolean } | undefined;
  cancelSwap: { shouldReset?: boolean } | undefined;
  setDefaultSwapParams: { tokenInSlug?: string; tokenOutSlug?: string } | undefined;
  switchSwapTokens: undefined;
  setSwapTokenIn: { tokenSlug: string };
  setSwapTokenOut: { tokenSlug: string };
  setSwapAmountIn: { amount?: number };
  setSwapAmountOut: { amount?: number };
  setSlippage: { slippage: number };
  loadSwapPairs: { tokenSlug: string; shouldForceUpdate?: boolean };
  estimateSwap: { shouldBlock: boolean };
  setSwapScreen: { state: SwapState };
  clearSwapError: undefined;
  estimateSwapCex: { shouldBlock: boolean };
  submitSwapCexFromTon: { password: string };
  submitSwapCexToTon: { password: string };
  setSwapType: { type: SwapType };
  setSwapCexAddress: { toAddress: string };
  addSwapToken: { token: UserSwapToken };
  toggleSwapSettingsModal: { isOpen: boolean };
}

export enum LoadMoreDirection {
  Forwards,
  Backwards,
}
