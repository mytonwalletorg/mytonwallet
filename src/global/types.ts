import type { TeactNode } from '../lib/teact/teact';

import type { ApiTonWalletVersion } from '../api/chains/ton/types';
import type { TonConnectProof } from '../api/dappProtocols/adapters';
import type {
  WcPayMerchant,
  WcPayPaymentAmount,
  WcPayPaymentInfo,
  WcPayPaymentOption,
} from '../api/dappProtocols/adapters/walletConnect/types';
import type { StoredDappConnection } from '../api/dappProtocols/storage';
import type { UnifiedSignDataPayload } from '../api/dappProtocols/types';
import type {
  ApiActivity,
  ApiAnyDisplayError,
  ApiBalanceBySlug,
  ApiBaseCurrency,
  ApiChain,
  ApiCountryCode,
  ApiCurrencyRates,
  ApiDappPermissions,
  ApiDappTransfer,
  ApiDerivation,
  ApiEmulationResult,
  ApiGroupedWalletVariant,
  ApiHistoryList,
  ApiImportAddressByChain,
  ApiNetwork,
  ApiNft,
  ApiNftCollection,
  ApiPriceHistoryPeriod,
  ApiSite,
  ApiSiteCategory,
  ApiStakingHistory,
  ApiStakingState,
  ApiTokenType,
  ApiTokenWithPrice,
  ApiUpdate,
  ApiUpdateDappCloseLoading,
  ApiUpdateDappConnect,
  ApiUpdateDappLoading,
  ApiUpdateDappSendTransactions,
  ApiUpdateDappSignData,
  ApiUpdateWalletConnectPayPaymentComplete,
  ApiUpdateWalletConnectPayProcessing,
  ApiUpdateWalletConnectPaySignData,
  ApiUpdateWalletConnectPaySignTransaction,
  ApiUpdateWalletVersions,
  ApiVestingInfo,
  ApiWalletWithVersionInfo,
} from '../api/types';
import type { AUTOLOCK_OPTIONS_LIST } from '../config';
import type { CapacitorPlatform } from '../util/capacitor/platform';
import type { ExplainedTransferFee } from '../util/fee/transferFee';

export type IAnchorPosition = {
  x: number;
  y: number;
};

export type AnimationLevel = 0 | 1 | 2;
export type Theme = 'light' | 'dark' | 'system';
export type AppTheme = 'dark' | 'light';
export type AppLayout = 'portrait' | 'landscape';
export type DialogAction = 'openReturnUrl';
export type ToastAction = 'openRenameWallet';

export type ToastType = {
  icon?: string;
  message: string;
} & (
  | { action?: undefined; actionText?: undefined }
  | { action: ToastAction; actionText: string }
);

export type DialogType = {
  title?: string;
  message: string | TeactNode;
  entities?: Record<string, any>;
  noBackdropClose?: boolean;
  isInAppLock?: boolean;
  buttons?: {
    confirm: { title?: string; action?: DialogAction; isDestructive?: boolean };
    cancel?: { title?: string };
  };
};

export type LangCode = 'en' | 'es' | 'ru' | 'zh-Hant' | 'zh-Hans' | 'tr' | 'de' | 'th' | 'uk' | 'pl' | 'ar' | 'fa';
export type LanguageSource = 'system' | 'user';

export interface LangItem {
  langCode: LangCode;
  name: string;
  nativeName: string;
  rtl: boolean;
}

export interface LangString {
  zeroValue?: string;
  oneValue?: string;
  twoValue?: string;
  fewValue?: string;
  manyValue?: string;
  otherValue?: string;
}

export type LangPack = Record<string, string | LangString>;

export type StakingStatus = 'active' | 'unstakeRequested';

export type AuthMethod = 'createAccount' | 'importMnemonic';

interface AuthAccount {
  accountId: string;
  byChain: Partial<Record<ApiChain, AccountChain>>;
  network?: ApiNetwork;
  partial?: Partial<Account>;
}

type SignOutLevel = 'account' | 'network' | 'all';

export enum AppState {
  Auth,
  Main,
  Explore,
  TokenInfo,
  Settings,
  Inactive,
  Empty,
}

export enum AuthState {
  none,
  createWallet,
  checkPassword,
  createPin,
  confirmPin,
  createBiometrics,
  createPassword,
  disclaimerAndBackup,
  importWalletCheckPassword,
  importWallet,
  importWalletCreatePin,
  importWalletConfirmPin,
  importWalletCreateBiometrics,
  importWalletCreatePassword,
  disclaimer,
  about,
  safetyRules,
  mnemonicPage,
  checkWords,
  importViewAccount,
  congratulations,
  importCongratulations,
  ready,
}

export type AuthType = 'passcode' | 'biometric';

export interface EnclaveSession {
  token: string;
  validUntil?: number;
}

export enum AccountSelectorState {
  Cards,
  List,
  Reorder,
  AddAccountInitial,
  AddAccountPassword,
  AddAccountViewMode,
}

export enum BiometricsState {
  None,
  TurnOnRegistration,
  TurnOnVerification,
  TurnOnComplete,
  TurnOffWarning,
  TurnOffCreatePassword,
  TurnOffComplete,
}

export enum TransferState {
  None,
  Initial,
  Confirm,
  Password,
  Complete,
  SelectAccount,
}

export const enum TransactionInfoState {
  None,
  Loading,
  ActivityList,
  ActivityDetail,
}

export const enum ScamWarningType {
  SeedPhrase = 1,
  DomainLike,
}

export enum SignDataState {
  None,
  Initial,
  Password,
  Complete,
}

export enum WalletConnectPayState {
  None,
  Initial,
  Password,
  Processing,
  Complete,
}

export enum DomainRenewalState {
  None,
  Initial,
  Password,
  Complete,
}

export enum DomainLinkingState {
  None,
  Initial,
  Password,
  Complete,
}

export enum DappConnectState {
  Info,
  SelectAccount,
  Password,
  AddAccountPassword,
}

export enum StakingState {
  None,

  StakeInitial,
  StakePassword,
  StakeComplete,

  UnstakeInitial,
  UnstakePassword,
  UnstakeComplete,

  ClaimPassword,
  ClaimComplete,

  StakeSelectAccount,
  UnstakeSelectAccount,
  ClaimSelectAccount,
}

export enum SettingsState {
  Initial,
  PushNotifications,
  Appearance,
  Assets,
  Security,
  Dapps,
  Language,
  About,
  Disclaimer,
  SelectTokenList,
  WalletVariants, // Wallet Derivations
  WalletVersions, // TON Versions
  HiddenNfts,
  BackupWallet,
  Permissions,
  Chains,
}

export enum ContentTab {
  Overview,
  Assets,
  Activity,
  Explore,
  Nft,
  Settings,
}

export enum MediaType {
  Nft,
}

/** Section of the "Hidden NFTs" settings screen the media viewer was opened from */
export type HiddenNftsSection = 'user' | 'scam' | 'unverified';

export type UserToken = {
  amount: bigint;
  name: string;
  localizedName?: string;
  symbol: string;
  image?: string;
  slug: string;
  price: number;
  priceUsd: number;
  decimals: number;
  change24h: number;
  chain: ApiChain;
  tokenAddress?: string;
  isDisabled?: boolean;
  keywords?: string[];
  cmcSlug?: string;
  totalValue: string;
  type?: ApiTokenType;
  color?: string;
  codeHash?: string;
  /** A small dim label to show in the UI right after the token name */
  label?: string;
  /** True if this is a staking token (created from ApiStakingState) */
  isStaking?: boolean;
  stakingId?: string;
};

export type TokenPeriod = '1D' | '7D' | '1M' | '3M' | '1Y' | 'ALL';

export type PriceHistoryPeriods = Partial<Record<ApiPriceHistoryPeriod, ApiHistoryList>>;

export type AccountType = 'mnemonic' | 'view';

export interface AccountChain {
  address: string;
  domain?: string;
  isMultisig?: true;
  derivation?: ApiDerivation;
}

export interface Account {
  title?: string;
  type: AccountType;
  byChain: Partial<Record<ApiChain, AccountChain>>;
  isTemporary?: true;
  isPrivateKeyBased?: true;
}

export type AssetPairs = Record<string, {
  isReverseProhibited?: boolean;
}>;

export interface AccountState {
  balances?: {
    bySlug: ApiBalanceBySlug;
  };
  activities?: {
    byId: Record<string, ApiActivity>;
    /**
     * The array values are sorted by the activity type (newest to oldest).
     * Undefined means that the activities haven't been loaded, [] means that there are no activities.
     */
    idsMain?: string[];
    /** The record values follow the same rules as `idsMain` */
    idsBySlug?: Record<string, string[]>;
    newestActivitiesBySlug?: Record<string, ApiActivity>;
    isMainHistoryEndReached?: boolean;
    isHistoryEndReachedBySlug?: Record<string, boolean>;
    localActivityIds?: string[];
    /** Doesn't include the local activities */
    pendingActivityIds?: Partial<Record<ApiChain, string[]>>;
    /**
     * May be false when the actual activities are actually loaded (when the app has been loaded from the cache).
     * The initial activities should be considered loaded if `idsMain` is not undefined.
     */
    areInitialActivitiesLoaded?: Partial<Record<ApiChain, boolean>>;
    /**
     * Per-chain main-feed ids. Populated on initial load and grown by `addPastActivities` so the
     * pagination boundary can be recomputed when any chain advances.
     */
    mainActivityIdsByChain?: Partial<Record<ApiChain, string[]>>;
    mainHistoryHasMoreByChain?: Partial<Record<ApiChain, boolean>>;
    /** SDK-provided aliases used only to preserve presentation identity across activity id replacements. */
    activityIdReplacements?: Record<string, string>;
  };
  nfts?: {
    byAddress?: Record<string, ApiNft>;
    orderedAddresses?: string[];
    currentCollection?: ApiNftCollection;
    selectedNfts?: ApiNft[];
    dnsExpiration?: Record<string, number>;
    linkedAddressByAddress?: Record<string, string>;
    collectionTabs?: ApiNftCollection[];
    isLoadedByAddress?: Record<string, true>;
    isFullLoadingByChain?: Partial<Record<ApiChain, boolean>>;
    /** Collection address -> last loaded timestamp for cache TTL */
    collectionLoadedTimestamps?: Record<string, number>;
  };
  blacklistedNftAddresses?: string[];
  whitelistedNftAddresses?: string[];
  selectedNftsToHide?: {
    addresses: string[];
    isCollection: boolean;
  };
  isUnhideNftModalOpen?: boolean;
  selectedNftToUnhide?: {
    address: ApiNft['address'];
    name: ApiNft['name'];
  };
  currentNftForAttributes?: ApiNft;
  shouldShowOwnerInNftAttributes?: true;
  dappLastOpenedDatesByUrl?: Record<string, number>;
  isBackupRequired?: boolean;
  currentTokenSlug?: string;
  currentActivityId?: string;
  currentTokenPeriod?: TokenPeriod;
  savedAddresses?: SavedAddress[];
  activeContentTab?: ContentTab;
  activityReturnContentTab?: ContentTab;
  activitiesUpdateStartedAt?: number;
  balanceUpdateStartedAt?: number;

  // Staking
  staking?: {
    stakingId?: string;
    stateById?: Record<string, ApiStakingState>;
    totalProfit?: bigint;
  };

  vesting?: {
    info: ApiVestingInfo[];
    isLoading?: boolean;
    isConfirmRequested?: boolean;
    error?: string;
    unfreezeRequestedIds?: { id: number; partId: number }[];
  };

  stakingHistory?: ApiStakingHistory;
  browserHistory?: string[];

  isLongUnstakeRequested?: boolean;
  receiveModalChain?: ApiChain;
  invoiceTokenSlug?: string;

  dapps?: StoredDappConnection[];
  currentSiteCategoryId?: number;

  isAppReady?: boolean;
}

export type ChainDisplayMode = 'value' | 'manual';

/**
 * How the Blockchains settings screen displays the account's chains.
 *
 * The iOS and Android apps read and write the same value under
 * `settings.byAccountId.<accountId>.chainDisplayConfiguration`, so keep these field names and shapes in sync
 * with `MChainDisplayConfiguration` in the `mobile` folder.
 *
 * `displayMode` - `value` lets the app order and hide the chains by balance; `manual` lets the user do it.
 * `hiddenChains` - chains the user turned off, even though the app would show them.
 * `shownChains` - chains the user turned on, even though the app would hide them.
 * `manualOrder` - the shown chains, in the order the user dragged them into.
 *
 * Only the user's differences from the app's own choice are stored, so a chain funded later appears on its own.
 */
export interface ChainDisplayConfiguration {
  displayMode: ChainDisplayMode;
  hiddenChains?: ApiChain[];
  shownChains?: ApiChain[];
  manualOrder?: ApiChain[];
}

export interface AccountSettings {
  pinnedSlugs?: string[];
  alwaysShownSlugs?: string[];
  alwaysHiddenSlugs?: string[];
  deletedSlugs?: string[];
  importedSlugs?: string[];
  chainDisplayConfiguration?: ChainDisplayConfiguration;
  // These NFTs should be saved in the settings for immediate use after launching the application,
  // without synchronizing the wallet history or complex state caching
  accentColorIndex?: number;
  isAllowSuspiciousActions?: boolean;
  areAssetsHidden?: boolean;
  areCollectiblesHidden?: boolean;
  overviewCellSize?: OverviewCellSize;
}

export type OverviewCellSize = 'small' | 'medium' | 'big';

export interface SavedAddress {
  name: string;
  address: string;
  chain: ApiChain;
}

export interface AddressBookItemData {
  name: string;
  address: string;
  chain: ApiChain | undefined;
  domain?: string;
  isSavedAddress?: boolean;
}

export interface NftTransfer {
  name?: string;
  address: string;
  thumbnail?: string;
  collectionName?: string;
}

export type GlobalState = {
  DEBUG_randomId?: number;

  appState: AppState;

  auth: {
    state: AuthState;
    method?: AuthMethod;
    isLoading?: boolean;
    mnemonic?: string[];
    mnemonicCheckIndexes?: number[];
    error?: string;
    pin?: string;
    isImportModalOpen?: boolean;
    accounts?: AuthAccount[];
    forceAddingTonOnlyAccount?: boolean;
    initialAddAccountState?: AccountSelectorState; // Initial rendering state for the `AccountSelectorModal` component
    shouldHideAddAccountBackButton?: boolean;
  };

  // Enclave
  authTypes?: AuthType[];
  enclaveSession?: EnclaveSession;
  /**
   * Number of accounts awaiting the multichain upgrade: they miss wallets for newly supported chains
   * or a backend auth token. The upgrade clears the count when it starts, so a non-zero value means
   * it has not run yet.
   */
  multichainUpgradeCount?: number;

  biometrics: {
    state: BiometricsState;
    error?: string;
  };

  currentTransfer: {
    state: TransferState;
    isLoading?: boolean;
    // Should be ignored when `nfts` is defined and not empty
    tokenSlug: string;
    toAddress?: string;
    toAddressName?: string;
    resolvedAddress?: string;
    error?: string;
    // Should be ignored when `nfts` is defined and not empty
    amount?: bigint;
    comment?: string;
    binPayload?: string;
    promiseId?: string;
    txId?: string;
    rawPayload?: string;
    stateInit?: string;
    shouldEncrypt?: boolean;
    isToNewAddress?: boolean;
    isScam?: boolean;
    nfts?: ApiNft[];
    sentNftsCount?: number;
    isMemoRequired?: boolean;
    scamWarningType?: ScamWarningType;
    isTransferReadonly?: boolean;
    isNftBurn?: boolean;
    /**
     * Normalized explanation of the fee for the current draft, ready for UI consumption.
     * Calculated on the API layer inside chain-specific `checkTransactionDraft`.
     * Every time this field value changes, the `amount` value should be actualized using `preserveMaxTransferAmount`.
     */
    explainedFee?: ExplainedTransferFee;
  };

  currentSignature?: {
    promiseId: string;
    dataHex: string;
    error?: string;
    isSigned?: boolean;
  };

  exploreData?: {
    featuredTitle?: string;
    categories: ApiSiteCategory[];
    sites: ApiSite[];
  };

  currentDappTransfer: {
    state: TransferState;
    isSse?: boolean;
    // Set while this is a placeholder modal opened by a wake deeplink (no request yet)
    isWaitingForRequest?: boolean;
    returnUrl?: string;
    promiseId?: string;
    isLoading?: boolean;
    transactions?: ApiDappTransfer[];
    /** What else should happen after submitting the transactions (in addition to the transactions) */
    emulation?: Pick<ApiEmulationResult, 'activities' | 'realFee'>;
    /** Unix seconds */
    validUntil?: number;
    viewTransactionOnIdx?: number;
    dapp?: StoredDappConnection;
    operationChain?: ApiChain;
    error?: string;
    shouldHideTransfers?: boolean;
    // Deal with solana b58/b64 issues based on requested method
    isLegacyOutput?: boolean;
  };

  currentDappSignData: {
    state: SignDataState;
    isSse?: boolean;
    promiseId?: string;
    isLoading?: boolean;
    dapp?: StoredDappConnection;
    operationChain?: ApiChain;
    payloadToSign?: UnifiedSignDataPayload;
    error?: string;
  };

  currentWalletConnectPay: {
    state: WalletConnectPayState;
    operation?: 'transaction' | 'signData' | 'payment';
    promiseId?: string;
    accountId?: string;
    merchant?: WcPayMerchant;
    operationChain?: ApiChain;
    transactions?: ApiDappTransfer[];
    emulation?: Pick<ApiEmulationResult, 'activities' | 'realFee'>;
    paymentInfo?: WcPayPaymentInfo;
    paymentOption?: WcPayPaymentOption;
    isSignOnly?: boolean;
    isLegacyOutput?: boolean;
    shouldHideTransfers?: boolean;
    validUntil?: number;
    payloadToSign?: UnifiedSignDataPayload;
    containsApprove?: boolean;
    approveOperationChain?: ApiChain;
    approveTransactions?: ApiDappTransfer[];
    approveValidUntil?: number;
    txId?: string;
    paymentAmount?: WcPayPaymentAmount;
    isLoading?: boolean;
    error?: string;
  };

  walletConnectPayDataCollection?: {
    promiseId: string;
    url: string;
    isCompleting?: boolean;
  };

  walletConnectPayOptionSelection?: {
    promiseId: string;
    paymentLink: string;
    accountId: string;
    merchant: WcPayMerchant;
    paymentInfo?: WcPayPaymentInfo;
    options: WcPayPaymentOption[];
    isLoading?: boolean;
    shouldSwitchWallet?: boolean;
  };

  currentDomainRenewal: {
    addresses?: string[];
    state: DomainRenewalState;
    isLoading?: boolean;
    error?: string;
    // There's only one commission because the transaction has no change
    realFee?: bigint;
    txId?: string;
  };

  currentDomainLinking: {
    address?: string;
    state: DomainLinkingState;
    isLoading?: boolean;
    error?: string;
    realFee?: bigint;
    walletAddress?: string;
    walletAddressName?: string;
    resolvedWalletAddress?: string;
    txId?: string;
  };

  dappConnectRequest?: {
    state: DappConnectState;
    isSse?: boolean;
    isLoading?: boolean;
    /** True while a new wallet is being prepared after password OK (before auth safety flow) */
    isCreatingAccount?: boolean;
    /** Set after importMnemonic succeeds; used to resume dapp connect after backup flow */
    pendingConnectAccountId?: string;
    promiseId?: string;
    accountId?: string;
    dapp: StoredDappConnection;
    permissions?: ApiDappPermissions;
    proof?: TonConnectProof;
    error?: string;
    multichainResolution?: 'switched-account' | 'needs-new-wallet';
  };

  currentStaking: {
    state: StakingState;
    isLoading?: boolean;
    isUnstaking?: boolean;
    amount?: bigint;
    initialAmount?: bigint | 'all';
    tokenAmount?: bigint;
    fee?: bigint;
    error?: string;
  };

  stakingDefault: ApiStakingState;

  accounts?: {
    byId: Record<string, Account>;
    isLoading?: boolean;
    error?: string;
  };

  tokenInfo: {
    bySlug: Record<string, ApiTokenWithPrice>;
  };

  currencyRates: ApiCurrencyRates;

  tokenPriceHistory: {
    bySlug: Record<string, PriceHistoryPeriods>;
  };

  byAccountId: Record<string, AccountState>;

  walletVersions?: {
    currentVersion: ApiTonWalletVersion;
    byId: Record<string, ApiWalletWithVersionInfo[]>;
  };

  settings: {
    state: SettingsState;
    theme: Theme;
    animationLevel: AnimationLevel;
    langCode: LangCode;
    langSource?: LanguageSource;
    byAccountId: Record<string, AccountSettings>;
    areTinyTransfersHidden?: boolean;
    areTokenNamesLocalized?: boolean;
    canPlaySounds?: boolean;
    isInvestorViewEnabled?: boolean;
    isTonProxyEnabled?: boolean;
    isDeeplinkHookEnabled?: boolean;
    isPasswordNumeric?: boolean; // Backwards compatibility for non-numeric passwords from older versions
    isTestnet?: boolean;
    isSecurityWarningHidden?: boolean;
    areTokensWithNoCostHidden: boolean;
    areUnverifiedNftsHidden?: boolean;
    importToken?: {
      isLoading?: boolean;
      token?: UserToken;
      error?: string;
    };
    baseCurrency: ApiBaseCurrency;
    isAppLockEnabled?: boolean;
    autolockValue?: AutolockValueType;
    isAutoConfirmEnabled?: boolean;
    isSensitiveDataHidden?: true;
    orderedAccountIds?: string[];
    selectedExplorerIds?: Partial<Record<ApiChain, string>>;
  };

  dialogs: DialogType[];
  toasts: ToastType[];
  currentAccountId?: string;
  currentTemporaryViewAccountId?: string;
  isAccountSelectorOpen?: boolean;
  isExchangeModalOpen?: boolean;
  walletRenameAccountId?: string;
  accountSelectorActiveTab?: number;
  accountSelectorViewMode?: 'cards' | 'list';
  isBackupWalletModalOpen?: boolean;
  isStakingInfoModalOpen?: boolean;
  isQrScannerOpen?: boolean;
  areSettingsOpen?: boolean;
  isExploreOpen?: boolean;
  isAppUpdateAvailable?: boolean;
  // Force show the "Update My Wallet" pop-up on all platforms
  isAppUpdateRequired?: boolean;
  confettiRequestedAt?: number;
  isPinAccepted?: boolean;
  isInvoiceModalOpen?: boolean;
  isReceiveModalOpen?: boolean;
  isVestingModalOpen?: boolean;
  isIncorrectTimeNotificationReceived?: boolean;
  isDerivationsSynced?: boolean;
  currentBrowserOptions?: {
    url: string;
    title?: string;
    subtitle?: string;
  };

  currentQrScan?: {
    currentTransfer?: GlobalState['currentTransfer'];
    currentDomainLinking?: GlobalState['currentDomainLinking'];
  };

  latestAppVersion?: string;
  stateVersion: number;
  restrictions: {
    isLimitedRegion: boolean;
    isNftBuyingDisabled: boolean;
    isCopyStorageEnabled?: boolean;
    countryCode?: ApiCountryCode;
  };

  mediaViewer: {
    mediaId?: string;
    mediaType?: MediaType;
    txId?: string;
    hiddenNfts?: HiddenNftsSection;
    noGhostAnimation?: boolean;
  };

  currentTransactionInfo: {
    state: TransactionInfoState;
    txId?: string;
    chain?: ApiChain;
    activities?: ApiActivity[];
    selectedActivityIndex?: number;
    error?: string;
  };

  isLoadingOverlayOpen?: boolean;

  pushNotifications: {
    isAvailable?: boolean;
    userToken?: string;
    platform?: CapacitorPlatform;
    enabledAccounts: string[]; // Values - account ids
  };

  isAppLockActive?: boolean;
  isManualLockActive?: boolean;
  appLockHideBiometrics?: boolean;
  isFullscreen?: boolean;
};

export interface ActionPayloads {
  // Initial
  init: undefined;
  initApi: undefined;
  afterInit: undefined;
  apiUpdate: ApiUpdate;
  resetAuth: undefined;
  startCreatingWallet: { enclaveToken?: string } | undefined;
  afterCheckMnemonic: undefined;
  afterCongratulations: { isImporting?: boolean };
  skipCheckMnemonic: undefined;
  restartCheckMnemonicIndexes: {
    wordsCount: number;
    preserveIndexes?: number[];
  };
  createPassword: { password: string; isNumeric?: boolean };
  skipBiometrics: undefined;
  setupBiometricAuth: undefined;
  skipCreateBiometrics: { isImporting?: boolean };
  createPin: { pin: string; isImporting: boolean };
  confirmPin: { isImporting: boolean };
  cancelConfirmPin: { isImporting: boolean };
  cancelCheckPassword: undefined;
  startImportingWallet: { enclaveToken?: string } | undefined;
  afterImportMnemonic: { mnemonic: string[] };
  confirmDisclaimer: undefined;
  afterConfirmDisclaimer: undefined;
  cleanAuthError: undefined;
  openAbout: undefined;
  closeAbout: undefined;
  openDisclaimer: undefined;
  closeDisclaimer: undefined;
  startImportViewAccount: undefined;
  closeImportViewAccount: undefined;
  openAuthImportWalletModal: undefined;
  closeAuthImportWalletModal: undefined;
  openAuthBackupWalletModal: undefined;
  openMnemonicPage: undefined;
  openCheckWordsPage: undefined;
  closeCheckWordsPage: { isBackupCreated?: boolean } | undefined;
  createAccount: { enclaveToken?: string; isPasswordNumeric?: boolean } | undefined;
  resetApiSettings: { areAllDisabled?: boolean } | undefined;
  checkAppVersion: undefined;
  importAccountByVersion: { version: ApiTonWalletVersion; isTestnetSubwalletId?: boolean };
  addSubWallet: { group: ApiGroupedWalletVariant };
  addAllFoundSubwallets: { foundSubwallets: ApiGroupedWalletVariant[] };
  createSubWallet: { enclaveToken: string };
  upgradeMultichainAccounts: { enclaveToken: string };
  importViewAccount: { addressByChain: ApiImportAddressByChain };
  openTemporaryViewAccount: { addressByChain: Partial<Record<ApiChain, string>> };
  saveTemporaryAccount: undefined;

  setEnclaveSession: EnclaveSession;
  releaseEnclaveSession: { enclaveToken: string };

  selectToken: { slug?: string } | undefined;
  openBackupWalletModal: undefined;
  closeBackupWalletModal: undefined;
  setIsBackupRequired: { isMnemonicChecked: boolean };
  setTransferScreen: { state: TransferState };
  setTransferAmount: { amount?: bigint };
  setTransferToAddress: { toAddress?: string };
  setTransferComment: { comment?: string };
  setTransferShouldEncrypt: { shouldEncrypt?: boolean };
  startTransfer: {
    tokenSlug?: string;
    amount?: bigint;
    toAddress?: string;
    comment?: string;
    nfts?: ApiNft[];
    binPayload?: string;
    stateInit?: string;
    isTransferReadonly?: boolean;
  } | undefined;
  changeTransferToken: { tokenSlug: string; withResetAmount?: boolean };
  fetchTransferFee: {
    tokenSlug: string;
    toAddress: string;
    amount?: bigint;
    comment?: string;
    shouldEncrypt?: boolean;
    binPayload?: string;
    stateInit?: string;
  };
  fetchNftFee: {
    toAddress: string;
    nfts: ApiNft[];
    comment?: string;
  };
  submitTransferInitial: {
    tokenSlug: string;
    amount: bigint;
    toAddress: string;
    comment?: string;
    shouldEncrypt?: boolean;
    nfts?: ApiNft[];
    isBase64Data?: boolean;
    binPayload?: string;
    stateInit?: string;
    isNftBurn?: boolean;
  };
  submitTransferConfirm: undefined;
  submitTransfer: { enclaveToken?: string } | undefined;
  clearTransferError: undefined;
  cancelTransfer: { shouldReset?: boolean } | undefined;
  switchTransferAccount: { accountId: string };
  showTransferScamWarning: { type: ScamWarningType };
  dismissTransferScamWarning: undefined;
  showDialog: DialogType;
  dismissDialog: undefined;
  showError: { error?: ApiAnyDisplayError | TeactNode | string };
  showToast: ToastType;
  dismissToast: undefined;
  afterSignIn: undefined;
  signOut: { level: SignOutLevel; accountId?: string };
  cancelCaching: undefined;
  afterSignOut: { shouldReset?: boolean } | undefined;
  addAccount: {
    method: AuthMethod;
    isAuthFlow?: boolean;
    clearDappConnectOnVerified?: boolean;
    /**
     * The token minted by the authorization that opened this flow. Carrying it forward is what tells the
     * flow it is already authorized - the session it came from is usage-scoped, so global state cannot
     * answer that question after the fact.
     */
    enclaveToken?: string;
  };
  addAccount2: { method: AuthMethod; enclaveToken?: string };
  switchAccount: { accountId: string; newNetwork?: ApiNetwork };
  renameAccount: { accountId: string; title: string };
  clearAccountError: undefined;
  clearAccountLoading: undefined;
  setIsAccountLoading: { isLoading: true | undefined };
  setIsAuthLoading: { isLoading: true | undefined };

  fetchPastActivities: { accountId?: string; slug?: string; shouldLoadWithBudget?: boolean };
  showActivityInfo: { id: string };
  showAnyAccountTx: { txId: string; accountId: string; network: ApiNetwork; chain: ApiChain };
  showTokenActivity: { slug: string; returnTab?: ContentTab };
  closeTokenActivity: undefined;
  closeActivityInfo: { id: string };
  fetchActivityDetails: { id: string };

  // External transaction info (deeplink)
  openTransactionInfo:
    | { txId: string; chain: ApiChain; activities?: ApiActivity[] }
    | { txHash: string; chain: ApiChain; activities?: ApiActivity[] };
  closeTransactionInfo: undefined;
  selectTransactionInfoActivity: { index: number };
  fetchNftsFromCollection: { collection: ApiNftCollection };
  clearNftCollectionLoading: { collection: ApiNftCollection };
  openNftCollection: { chain: ApiChain; address: string };
  closeNftCollection: undefined;
  selectNfts: { nfts: ApiNft[] };
  selectAllNfts: { collectionAddress?: string };
  clearNftSelection: { address: string };
  clearNftsSelection: undefined;
  addCollectionTab: { collection: ApiNftCollection; isAuto?: boolean };
  removeCollectionTab: { collection: ApiNftCollection };
  burnNfts: { nfts: ApiNft[] };
  addNftsToBlacklist: { addresses: ApiNft['address'][] };
  addNftsToWhitelist: { addresses: ApiNft['address'][] };
  removeNftSpecialStatus: { address: ApiNft['address'] };
  openUnhideNftModal: {
    address: ApiNft['address'];
    name: ApiNft['name'];
  };
  closeUnhideNftModal: undefined;
  openHideNftModal: {
    addresses: ApiNft['address'][];
    isCollection: boolean;
  };
  closeHideNftModal: undefined;
  openNftAttributesModal: { nft: ApiNft; withOwner?: true };
  closeNftAttributesModal: undefined;

  openExplore: undefined;
  closeExplore: undefined;

  closeAnyModal: undefined;
  submitSignature: { enclaveToken: string };
  clearSignatureError: undefined;
  cancelSignature: undefined;

  addSavedAddress: { address: string; name: string; chain: ApiChain };
  removeFromSavedAddress: { address: string; chain: ApiChain };
  checkTransferAddress: { address?: string; chain?: ApiChain };

  openAccountSelector: undefined;
  closeAccountSelector: undefined;
  openWalletRenameModal: { accountId?: string } | undefined;
  closeWalletRenameModal: undefined;
  setAccountSelectorTab: { tab: number };
  setAccountSelectorViewMode: { mode: 'cards' | 'list' };
  setCurrentTokenPeriod: { period: TokenPeriod };
  openAddAccountModal: {
    forceAddingTonOnlyAccount?: boolean;
    initialState?: AccountSelectorState;
    shouldHideBackButton?: boolean;
  } | undefined;
  closeAddAccountModal: undefined;

  setActiveContentTab: { tab: ContentTab };

  // BottomBar actions
  switchToWallet: undefined;
  switchToExplore: undefined;
  switchToSettings: undefined;

  requestConfetti: undefined;
  setIsPinAccepted: undefined;
  clearIsPinAccepted: undefined;

  requestOpenQrScanner: undefined;
  closeQrScanner: undefined;
  handleQrCode: { data: string };

  // Staking
  startStaking: {
    stakingId?: string;
    tokenSlug?: string;
    initialAmount?: bigint | 'all';
  } | undefined;
  startUnstaking: { stakingId: string } | undefined;
  setStakingScreen: { state: StakingState };
  submitStakingInitial: { amount?: bigint; isUnstaking?: boolean } | undefined;
  submitStaking: { enclaveToken?: string; isUnstaking?: boolean } | undefined;
  clearStakingError: undefined;
  cancelStaking: undefined;
  fetchStakingHistory: undefined;
  fetchStakingFee: { amount: bigint };
  openStakingInfo: undefined;
  openAnyAccountStakingInfo: { accountId: string; network: ApiNetwork; stakingId: string };
  closeStakingInfo: undefined;
  changeCurrentStaking: { stakingId: string; shouldReopenModal?: boolean };
  startStakingClaim: { stakingId: string } | undefined;
  submitStakingClaim: { enclaveToken?: string } | undefined;
  cancelStakingClaim: undefined;
  openStakingInfoOrStart: undefined;
  switchStakingAccount: { accountId: string; mode: 'stake' | 'unstake' | 'claim' };

  // Settings
  openSettings: undefined;
  openSettingsWithState: { state: SettingsState };
  setSettingsState: { state?: SettingsState };
  closeSettings: undefined;
  setTheme: { theme: Theme };
  setAnimationLevel: { level: AnimationLevel };
  toggleTinyTransfersHidden: { isEnabled?: boolean } | undefined;
  toggleUnverifiedNftsHidden: { isEnabled?: boolean } | undefined;
  toggleLocalizedTokenNames: { isEnabled?: boolean } | undefined;
  toggleInvestorView: { isEnabled?: boolean } | undefined;
  toggleCanPlaySounds: { isEnabled?: boolean } | undefined;
  toggleTonProxy: { isEnabled: boolean };
  toggleDeeplinkHook: { isEnabled: boolean };
  startChangingNetwork: { network: ApiNetwork };
  changeNetwork: { network: ApiNetwork };
  changeLanguage: { langCode: LangCode };
  setSelectedExplorerId: { chain: ApiChain; explorerId: string };
  closeSecurityWarning: undefined;
  toggleTokensWithNoCost: { isEnabled: boolean };
  pinToken: { slug: string };
  unpinToken: { slug: string };
  toggleTokenVisibility: { slug: string; shouldShow: boolean };
  toggleChainVisibility: { chain: ApiChain; shouldShow: boolean };
  setChainDisplayMode: { displayMode: ChainDisplayMode };
  updateChainDisplayOrder: { orderedChains: ApiChain[] };
  setOverviewCellSize: { size: OverviewCellSize };
  setAreAssetsHidden: { isHidden: boolean };
  setAreCollectiblesHidden: { isHidden: boolean };
  addToken: { token: UserToken };
  deleteToken: { slug: string };
  importToken: { chain: ApiChain; address: string };
  updateOrderedAccountIds: { orderedAccountIds: string[] };
  rebuildOrderedAccountIds: undefined;
  resetImportToken: undefined;
  closeBiometricSettings: undefined;
  openBiometricsTurnOffWarning: undefined;
  enableBiometrics: { isLoginFlow?: boolean } | undefined;
  disableBiometrics: { newPassword?: string; isPasswordNumeric?: boolean } | undefined;
  changePasscode: { passcode: string; onSuccess: NoneToVoidFunction };
  changeBaseCurrency: { currency: ApiBaseCurrency };
  copyStorageData: undefined;
  setAppLockValue: { value?: AutolockValueType; isEnabled: boolean };
  setIsManualLockActive: { isActive?: boolean; shouldHideBiometrics?: boolean };
  setIsAutoConfirmEnabled: { isEnabled: boolean };
  setIsAllowSuspiciousActions: { isEnabled: boolean };
  apiUpdateWalletVersions: ApiUpdateWalletVersions;

  // Account Settings
  setAccentColorIndex: { accentColorIndex?: number };

  // TON Connect common
  apiUpdateDappLoading: ApiUpdateDappLoading;
  apiUpdateDappCloseLoading: ApiUpdateDappCloseLoading;

  // TON Connect connection
  submitDappConnectRequestConfirm: { accountId: string; enclaveToken?: string };
  clearDappConnectRequestError: undefined;
  cancelDappConnectRequestConfirm: undefined;
  setDappConnectRequestState: { state: DappConnectState };
  apiUpdateDappConnect: ApiUpdateDappConnect;

  // TON Connect transfer
  setDappTransferScreen: { state: TransferState };
  showDappTransferTransaction: { transactionIdx: number };
  submitDappTransferConfirm: undefined;
  submitDappTransfer: { enclaveToken?: string } | undefined;
  clearDappTransferError: undefined;
  cancelDappTransfer: undefined;
  closeDappTransfer: undefined;
  apiUpdateDappSendTransaction: ApiUpdateDappSendTransactions;

  // TON Connect SignData
  setDappSignDataScreen: { state: SignDataState };
  submitDappSignDataConfirm: undefined;
  submitDappSignData: { enclaveToken?: string } | undefined;
  clearDappSignDataError: undefined;
  cancelDappSignData: undefined;
  closeDappSignData: undefined;
  apiUpdateDappSignData: ApiUpdateDappSignData;

  getDapps: undefined;
  deleteAllDapps: undefined;
  deleteDapp: { url: string; uniqueId: string };
  loadExploreSites: { isLandscape: boolean; langCode: LangCode | undefined };
  updateDappLastOpenedAt: { url: string };

  addSiteToBrowserHistory: { url: string };
  removeSiteFromBrowserHistory: { url: string };
  openBrowser: { url: string; title?: string; subtitle?: string };
  closeBrowser: undefined;
  openSiteCategory: { id: number };
  closeSiteCategory: undefined;
  switchAccountAndOpenUrl: {
    accountId?: string;
    network?: ApiNetwork;
    url: string;
    isExternal?: boolean;
    title?: string;
    subtitle?: string;
  };

  // Exchange
  startExchange: undefined;
  closeExchange: undefined;

  // WalletConnect Pay
  apiUpdateWalletConnectPayLoading: { accountId: string };
  apiUpdateWalletConnectPayProcessing: ApiUpdateWalletConnectPayProcessing;
  apiUpdateWalletConnectPayPaymentComplete: ApiUpdateWalletConnectPayPaymentComplete;
  apiUpdateWalletConnectPaySignTransaction: ApiUpdateWalletConnectPaySignTransaction;
  apiUpdateWalletConnectPaySignData: ApiUpdateWalletConnectPaySignData;
  submitWalletConnectPaySignTransaction: { enclaveToken?: string } | undefined;
  submitWalletConnectPaySignData: { enclaveToken?: string } | undefined;
  clearWalletConnectPayError: undefined;
  cancelWalletConnectPay: undefined;
  closeWalletConnectPay: undefined;
  completeWalletConnectPayDataCollection: undefined;
  closeWalletConnectPayDataCollection: undefined;
  confirmWalletConnectPayOptionSelection: { optionId: string };
  closeWalletConnectPayOptionSelection: undefined;
  switchWalletConnectPayOptionSelectionAccount: { accountId: string };

  // MediaViewer
  openMediaViewer: {
    mediaId: string;
    mediaType: MediaType;
    txId?: string;
    hiddenNfts?: HiddenNftsSection;
    noGhostAnimation?: boolean;
  };
  closeMediaViewer: undefined;

  openReceiveModal: { chain: ApiChain } | undefined;
  closeReceiveModal: undefined;
  setReceiveActiveTab: { chain: ApiChain };
  openInvoiceModal: { tokenSlug: string } | undefined;
  changeInvoiceToken: { tokenSlug: string };
  closeInvoiceModal: undefined;

  loadPriceHistory: { slug: string; period: ApiPriceHistoryPeriod; currency?: ApiBaseCurrency };

  showIncorrectTimeError: undefined;

  openLoadingOverlay: undefined;
  closeLoadingOverlay: undefined;

  openVestingModal: undefined;
  closeVestingModal: undefined;
  startClaimingVesting: undefined;
  submitClaimingVesting: { enclaveToken?: string } | undefined;
  clearVestingError: undefined;
  cancelClaimingVesting: undefined;

  toggleNotifications: { isEnabled: boolean };
  renameNotificationAccount: { accountId: string };
  toggleNotificationAccount: { accountId: string };
  createNotificationAccount: { accountId: string; withAbort?: boolean };
  tryAddNotificationAccount: { accountId: string };
  deleteNotificationAccount: { accountId: string; withAbort?: boolean };
  deleteAllNotificationAccounts: undefined | { accountIds: string[] };
  registerNotifications: { userToken: string; platform: CapacitorPlatform };

  openFullscreen: undefined;
  closeFullscreen: undefined;
  setAppLayout: { layout: AppLayout };

  setIsSensitiveDataHidden: { isHidden: boolean };

  openDomainRenewalModal: { accountId?: string; network?: ApiNetwork; addresses: string[] };
  startDomainsRenewal: undefined;
  checkDomainsRenewalDraft: { nfts: ApiNft[] };
  submitDomainsRenewal: { enclaveToken?: string } | undefined;
  clearDomainsRenewalError: undefined;
  cancelDomainsRenewal: undefined;

  openDomainLinkingModal: { address: string };
  startDomainLinking: undefined;
  checkDomainLinkingDraft: { nft: ApiNft };
  submitDomainLinking: { enclaveToken?: string } | undefined;
  clearDomainLinkingError: undefined;
  cancelDomainLinking: undefined;

  checkLinkingAddress: { address?: string };
  setDomainLinkingWalletAddress: { address?: string };
  setIsAppLockActive: { isActive: boolean };
}

export enum LoadMoreDirection {
  Forwards,
  Backwards,
}

export type AutolockValueType = (typeof AUTOLOCK_OPTIONS_LIST[number])['value'];
