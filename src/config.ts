/* eslint-disable @stylistic/max-len */
import type { ApiTonWalletVersion } from './api/chains/ton/types';
import type {
  ApiBaseCurrency,
  ApiChain,
  ApiLiquidStakingState,
  ApiNftMarketplace,
  ApiToken,
} from './api/types';
import type { TOKEN_CARD_COLORS } from './components/main/helpers/cardColors';
import type { AutolockValueType, LangCode, LangItem } from './global/types';

export const APP_ENV = process.env.APP_ENV || 'production';

export const APP_NAME = process.env.APP_NAME || 'ION Wallet';
export const APP_VERSION = process.env.APP_VERSION!;
export const APP_COMMIT_HASH = process.env.APP_COMMIT_HASH!;
export const APP_ENV_MARKER = APP_ENV === 'staging' ? 'Beta' : APP_ENV === 'development' ? 'Dev' : undefined;
export const EXTENSION_NAME = 'ION Wallet • Crypto & Web3';
export const EXTENSION_DESCRIPTION = 'Self-custodial wallet for ION and BNB. '
  + 'Swap, stake, manage NFTs and explore dapps.';

export const DEBUG = APP_ENV !== 'production' && APP_ENV !== 'perf' && APP_ENV !== 'test';
export const DEBUG_MORE = false;
export const DEBUG_API = false;
export const DEBUG_VIEW_ACCOUNTS = false;
export const TEST_MNEMONIC = process.env.TEST_MNEMONIC?.trim();
export const TEST_PASSWORD = process.env.TEST_PASSWORD || 'test';

export const IS_PRODUCTION = APP_ENV === 'production';
export const IS_STAGING = APP_ENV === 'staging';
export const IS_TEST = APP_ENV === 'test';
export const IS_PERF = APP_ENV === 'perf';
export const IS_EXTENSION = process.env.IS_EXTENSION === '1';
export const IS_FIREFOX_EXTENSION = process.env.IS_FIREFOX_EXTENSION === '1';
export const IS_OPERA_EXTENSION = process.env.IS_OPERA_EXTENSION === '1';
export const IS_PACKAGED_ELECTRON = process.env.IS_PACKAGED_ELECTRON === '1';
export const IS_CAPACITOR = process.env.IS_CAPACITOR === '1';
export const IS_ANDROID_DIRECT = process.env.IS_ANDROID_DIRECT === '1';
export const IS_ANDROID = IS_ANDROID_DIRECT || process.env.CAP_PLATFORM === 'android';
export const IS_HEADLESS = process.env.IS_HEADLESS === '1';

export const ELECTRON_HOST_URL = 'https://dumb-host';
export const INACTIVE_MARKER = '[Inactive]';
export const PRODUCTION_URL = 'https://wallet.ice.io';
export const BETA_URL = 'https://beta.wallet.ice.io';
// Beta desktop auto-update feed base. This is BOTH the staging gate poll base and the value baked
// into app-update.yml by the generic electron-builder provider - the two must agree.
export const BETA_UPDATE_URL = 'https://s3.wallet.ice.io/public/desktop-beta';
// Legacy brand hosts are intentionally not recognised by this build.
export const LEGACY_APP_HOSTS: string[] = [];
// Where a legacy-host visitor is nudged to continue on the current brand. Opened via a plain anchor or `window.open`,
// never `openUrl`: `SUBPROJECT_URL_MASK` treats every `*.wallet.ice.io` host as a subproject, so `openUrl` would append
// the wallet context (addresses included) and open it in the in-app iframe browser - where the site renders blank
// under `X-Frame-Options: Deny`. `utm_source` attributes the migrated traffic.
export const NEW_APP_URL = `${PRODUCTION_URL}?utm_source=legacy_web`;
export const APP_INSTALL_URL = 'https://wallet.ice.io/download';
export const APP_REPO_URL = 'https://wallet.ice.io';
export const SELF_UNIVERSAL_HOST_URL = 'https://wallet.ice.io';
export const APP_WEBSITE_URL = 'https://wallet.ice.io';
export const APP_ICON_URL = 'https://wallet.ice.io/icon-512x512.png';

// GitHub workflow uses an empty string as the default value if it's not in repository variables, so we cannot define a default value here
export const BASE_URL = process.env.BASE_URL || PRODUCTION_URL;

export const BOT_USERNAME = process.env.BOT_USERNAME || 'IONWalletBot';

export const SWAP_FEE_ADDRESS = process.env.SWAP_FEE_ADDRESS || 'UQDUkQbpTVIgt7v66-JTFR-3-eXRFz_4V66F-Ufn6vOg0GOp';

export const STRICTERDOM_ENABLED = DEBUG && !IS_PACKAGED_ELECTRON;

export const DEBUG_ALERT_MSG = 'Shoot!\nSomething went wrong, please see the error details in Dev Tools Console.';

export const PIN_LENGTH = 4;

export const NATIVE_BIOMETRICS_PROMPT_KEY = 'confirm an action in ION Wallet';
// Keychain and Keystore address the stored secret by this pair, so changing either orphans
// the credentials already saved on the device
export const NATIVE_BIOMETRICS_USERNAME = 'IONWallet';
export const NATIVE_BIOMETRICS_SERVER = 'https://wallet.ice.io';

export const MNEMONIC_COUNT = 24;
export const MNEMONIC_COUNTS = [12, 24];

export const PRIVATE_KEY_HEX_LENGTH = 64;
export const MNEMONIC_CHECK_COUNT = 3;

export const MOBILE_SCREEN_MAX_WIDTH = 700; // px

export const VIEW_TRANSITION_CLASS_NAME = 'active-view-transition';

export const ANIMATION_END_DELAY = 50;

export const ANIMATED_STICKER_TINY_ICON_PX = 16;
export const ANIMATED_STICKER_ICON_PX = 30;
export const ANIMATED_STICKER_TINY_SIZE_PX = 70;
export const ANIMATED_STICKER_SMALL_SIZE_PX = 110;
export const ANIMATED_STICKER_MIDDLE_SIZE_PX = 120;
export const ANIMATED_STICKER_DEFAULT_PX = 150;
export const ANIMATED_STICKER_BIG_SIZE_PX = 156;
export const ANIMATED_STICKER_HUGE_SIZE_PX = 192;

export const DEFAULT_PORTRAIT_WINDOW_SIZE = { width: 368, height: 770 };
export const DEFAULT_LANDSCAPE_WINDOW_SIZE = { width: 980, height: 788 };
export const TRANSACTION_ADDRESS_SHIFT = 4;

export const WHOLE_PART_DELIMITER = ' '; // https://www.compart.com/en/unicode/U+202F

export const DEFAULT_SLIPPAGE_VALUE = 5;

export const GLOBAL_STATE_CACHE_DISABLED = false;
export const GLOBAL_STATE_CACHE_KEY = 'ionwallet-global-state';

export const ANIMATION_LEVEL_MIN = 0;
export const ANIMATION_LEVEL_MED = 1;
export const ANIMATION_LEVEL_MAX = 2;
export const ANIMATION_LEVEL_DEFAULT = ANIMATION_LEVEL_MAX;
export const THEME_DEFAULT = 'system';

export const MAIN_ACCOUNT_ID = '0-ton-mainnet';
export const TEMPORARY_ACCOUNT_NAME = 'Wallet';

export const TONCENTER_MAINNET_URL = process.env.TONCENTER_MAINNET_URL || 'https://api.mainnet.ice.io';
export const TONCENTER_MAINNET_KEY = process.env.TONCENTER_MAINNET_KEY;
export const ELECTRON_TONCENTER_MAINNET_KEY = process.env.ELECTRON_TONCENTER_MAINNET_KEY;

export const TONCENTER_TESTNET_URL = process.env.TONCENTER_TESTNET_URL || 'https://api.testnet.ice.io';
export const TONCENTER_TESTNET_KEY = process.env.TONCENTER_TESTNET_KEY;
export const ELECTRON_TONCENTER_TESTNET_KEY = process.env.ELECTRON_TONCENTER_TESTNET_KEY;

export const BRILLIANT_API_BASE_URL = process.env.BRILLIANT_API_BASE_URL || 'https://api.wallet.ice.io';
export const PROXY_API_BASE_URL = process.env.PROXY_API_BASE_URL || 'https://api.wallet.ice.io/proxy';
export const IPFS_GATEWAY_BASE_URL = 'https://ipfs.io/ipfs/';
export const SSE_BRIDGE_URL = 'https://tonconnectbridge.wallet.ice.io/bridge/';

export const WALLET_CONNECT_BRIDGE_PATTERNS = 'https://*.walletconnect.com https://*.walletconnect.org wss://*.walletconnect.com wss://*.walletconnect.org';

/** WalletConnect Pay API + collect iframe (multi-level subdomains; not covered by `*.walletconnect.com`). */
export const WALLET_CONNECT_PAY_CONNECT_ORIGINS = [
  'https://api.pay.walletconnect.com/',
  'https://api.pay.walletconnect.org/',
  'https://staging.api.pay.walletconnect.org/',
  'https://pay.walletconnect.com/',
];

export const WALLET_CONNECT_PAY_FRAME_ORIGINS = [
  'https://pay.walletconnect.com/',
];

export const WALLET_CONNECT_PROJECT_ID = process.env.WALLET_CONNECT_PROJECT_ID || '';
export const WALLET_CONNECT_PAY_APP_ID = process.env.WALLET_CONNECT_PAY_APP_ID || '';

export const EVM_MAINNET_RPC_URL = process.env.EVM_MAINNET_RPC_URL || 'https://evmapi.wallet.ice.io';
export const EVM_TESTNET_RPC_URL = process.env.EVM_TESTNET_RPC_URL || 'https://evmapi-testnet.wallet.ice.io';

export const FRACTION_DIGITS = 9;
export const SHORT_FRACTION_DIGITS = 2;

export const MAX_PUSH_NOTIFICATIONS_ACCOUNT_COUNT = 3;

export const NFT_MARKETPLACE_TITLES: Record<ApiNftMarketplace, string> = {
  getgems: 'Getgems',
  opensea: 'OpenSea',
};
export const MW_STATIC_BASE_URL = 'https://static.wallet.ice.io';
export const APP_PROMO_URL = 'https://wallet.ice.io/';
export const APP_WEBSITE_HOST = 'wallet.ice.io';
export const APP_TERMS_OF_USE_URL = 'https://wallet.ice.io/terms-of-use';
export const APP_PRIVACY_POLICY_URL = 'https://wallet.ice.io/privacy-policy';
export const MY_WALLET_BLOG: Partial<Record<LangCode, string>> = {
  en: 'https://wallet.ice.io/en/blog/',
  ru: 'https://wallet.ice.io/ru/blog/',
};

export const NFT_MARKETPLACE_URL = 'https://opensea.io/';
export const NFT_MARKETPLACE_TITLE = NFT_MARKETPLACE_TITLES.opensea;
export const TON_NFT_MARKETPLACE_URL = 'https://getgems.io/';
export const TON_NFT_MARKETPLACE_TITLE = NFT_MARKETPLACE_TITLES.getgems;
export const GETGEMS_BASE_MAINNET_URL = 'https://getgems.io/';
export const GETGEMS_BASE_TESTNET_URL = 'https://testnet.getgems.io/';
export const EMPTY_HASH_VALUE = 'NOHASH';

export const IFRAME_WHITELIST = [
  'http://localhost:*',
  'https://tonscan.org',
  'https://testnet.tonscan.org',
  'https://tonviewer.com',
  'https://testnet.tonviewer.com',
];
export const SUBPROJECT_URL_MASK = 'https://*.wallet.ice.io';

export const CEX_WAITING_DEADLINE = 3 * 60 * 60 * 1000; // 3 hours

export const PROXY_HOSTS = process.env.PROXY_HOSTS;

export const TINY_TRANSFER_MAX_COST = 0.01;

export const IMAGE_CACHE_NAME = 'mtw-image';
export const LANG_CACHE_NAME = 'mtw-lang-354';

export const LANG_LIST: LangItem[] = [{
  langCode: 'en',
  name: 'English',
  nativeName: 'English',
  rtl: false,
}, {
  langCode: 'es',
  name: 'Spanish',
  nativeName: 'Español',
  rtl: false,
}, {
  langCode: 'ru',
  name: 'Russian',
  nativeName: 'Русский',
  rtl: false,
}, {
  langCode: 'zh-Hans',
  name: 'Chinese (Simplified)',
  nativeName: '简体',
  rtl: false,
}, {
  langCode: 'zh-Hant',
  name: 'Chinese (Traditional)',
  nativeName: '繁體',
  rtl: false,
}, {
  langCode: 'tr',
  name: 'Turkish',
  nativeName: 'Türkçe',
  rtl: false,
}, {
  langCode: 'de',
  name: 'German',
  nativeName: 'Deutsch',
  rtl: false,
}, {
  langCode: 'th',
  name: 'Thai',
  nativeName: 'ไทย',
  rtl: false,
}, {
  langCode: 'uk',
  name: 'Ukrainian',
  nativeName: 'Українська',
  rtl: false,
}, {
  langCode: 'pl',
  name: 'Polish',
  nativeName: 'Polski',
  rtl: false,
}, {
  langCode: 'ar',
  name: 'Arabic',
  nativeName: 'العربية',
  rtl: true,
}, {
  langCode: 'fa',
  name: 'Persian',
  nativeName: 'فارسی',
  rtl: true,
}];

// Blacklist-style feature flags (default unset = feature ON). Each is substituted at build time by
// `EnvironmentPlugin`, so it both drives Webpack dead-code elimination (drops code + npm deps) and is
// readable at runtime to silence behaviour/network for anything still bundled.
export const NO_TON = process.env.NO_TON === '1';
export const NO_EVM = process.env.NO_EVM === '1';
/**
 * Drops the unconfirmed activities from the TON activity feed: the poller stops asking the indexer for
 * them, so a transfer shows up only once it is finalized.
 *
 * The ION indexer serves no `/pendingActions` and has no update socket, which are the two sources of
 * such activities; without this flag every poll spends a failing request on them. Clear it once the
 * indexer gains either.
 */
export const NO_PENDING_ACTIVITIES = process.env.NO_PENDING_ACTIVITIES === '1';
/** Disables unavailable ION WebSockets; data uses HTTP polling. */
export const NO_WEBSOCKET = process.env.NO_WEBSOCKET === '1';
/**
 * Standalone SDK builds, embedded by third-party apps that ship their own UI, so nothing in the UI layer
 * reads this flag.
 *
 * What stays is a plain wallet: accounts, transfers, tokens, activities, NFTs, domains and TON Connect.
 * Swap, staking, WalletConnect, the explore catalogue, portfolio history, push notifications, legacy
 * (pre-Enclave) auth, encrypted comments and the receive-screen backgrounds all go — their
 * methods leave the dispatch table and their modules leave the bundle.
 */
export const NO_EXTRA_FEATURES = process.env.NO_EXTRA_FEATURES === '1';
export const VALIDATION_PERIOD_MS = 65_536_000; // 18.2 h.
export const ONE_TON = 1_000_000_000n;
export const DEFAULT_FEE = 15_000_000n; // 0.015 TON
export const UNSTAKE_TON_GRACE_PERIOD = 20 * 60 * 1000; // 20 m.

export const LIQUID_POOL = process.env.LIQUID_POOL || 'EQAYI9vwZ3K5y9n_9-E8F_e3JzMzNNyEib0ddBlfAWOOsh_c';
export const LIQUID_JETTON = process.env.LIQUID_JETTON || 'EQACbwI38RnvclU5Wv6H9zDr8Ao_tq9NWilXxBmoE8yroZlF';
export const STAKING_MIN_AMOUNT = ONE_TON;
export const MIN_ACTIVE_STAKING_REWARDS = 100_000_000n; // 0.1 MY
// Staked tokens now showing with all other tokens, so we need to add a prefix to avoid collisions
export const STAKING_SLUG_PREFIX = 'staking-';

export const TONCONNECT_PROTOCOL_VERSION = 2;
export const TONCONNECT_WALLET_JSBRIDGE_KEY = 'ionwallet';
export const EMBEDDED_DAPP_BRIDGE_CHANNEL = 'embedded-dapp-bridge';

export const TON_DNS_RENEWAL_WARNING_DAYS = 14;
export const TON_DNS_RENEWAL_NFT_WARNING_DAYS = 30;

export const TONCOIN = {
  name: 'ION',
  symbol: 'ION',
  slug: 'toncoin',
  decimals: 9,
  chain: 'ton',
  cmcSlug: 'toncoin',
} as const;

export const BNB = {
  name: 'BNB',
  symbol: 'BNB',
  slug: 'bnb',
  decimals: 18,
  chain: 'bnb',
} as const;

export const STAKED_TON_SLUG = `ton-${LIQUID_JETTON}`;

// Tokens that do not accept new stakes; existing positions stay fully withdrawable
export const NEW_STAKE_DISABLED_TOKEN_SLUGS: ReadonlySet<string> = new Set();

export const DNS_IMAGE_GEN_URL = 'https://dns-image.wallet.ice.io/img?d=';

// Wrapped ION on BNB Smart Chain: the bridged form of the native coin, verified on-chain
// (symbol ION, name "Ice Open Network", 9 decimals).
export const ION_BNB_MAINNET = {
  name: 'Ice Open Network',
  symbol: 'ION',
  decimals: 9,
  chain: 'bnb',
  slug: 'bnb-0xE1ab61f7b093435204dF32F5b3A405de55445Ea8',
  tokenAddress: '0xE1ab61f7b093435204dF32F5b3A405de55445Ea8',
  label: 'BEP-20',
} as const;

/** The properties not returned by the backend, and therefore not stored in token objects */
export const TOKEN_CUSTOM_STYLES: Partial<Record<string, {
  fontIcon?: string;
  cardColor?: keyof typeof TOKEN_CARD_COLORS;
}>> = {
  [TONCOIN.slug]: {
    fontIcon: 'icon-chain-ton',
    cardColor: 'blue',
  },
  [BNB.slug]: {
    fontIcon: 'icon-chain-bnb',
    cardColor: 'green',
  },
  [STAKED_TON_SLUG]: {
    cardColor: 'green',
  },
};

export const ALL_STAKING_POOLS = [
  LIQUID_POOL,
];

// Native tokens in the UI display order (see CHAIN_DISPLAY_ORDER). Drives the empty-wallet token order.
export const PRIORITY_TOKENS = [
  TONCOIN,
  BNB,
] as ApiToken[];

export const DEFAULT_TRANSFER_TOKEN_SLUG = TONCOIN.slug;

export const ACTIVE_TAB_STORAGE_KEY = 'mtw-active-tab';

export const INDEXED_DB_NAME = 'keyval-store';
export const INDEXED_DB_STORE_NAME = 'keyval';

export const WINDOW_PROVIDER_CHANNEL = 'windowProvider';
export const WINDOW_PROVIDER_PORT = 'IONWallet_popup_reversed';

export const PORTRAIT_MIN_ASSETS_TAB_VIEW = 6;

export const DEFAULT_PRICE_CURRENCY = 'USD';
export const CURRENCIES: Record<
  ApiBaseCurrency,
  // Get the fallback rates at https://api.wallet.ice.io/currency-rates
  { name: string; decimals: number; shortSymbol?: string; shortSymbolPosition?: 'start' | 'end'; fallbackRate: string }
> = {
  USD: {
    name: 'US Dollar',
    decimals: 2,
    shortSymbol: '$',
    fallbackRate: '1',
  },
  EUR: {
    name: 'Euro',
    decimals: 2,
    shortSymbol: '€',
    fallbackRate: '0.85233500',
  },
  RUB: {
    name: 'Russian Ruble',
    decimals: 2,
    shortSymbol: '₽',
    fallbackRate: '84.49824600',
  },
  CNY: {
    name: 'Chinese Yuan',
    decimals: 2,
    shortSymbol: '¥',
    fallbackRate: '7.11865000',
  },
  BTC: {
    name: 'Bitcoin',
    decimals: 9,
    fallbackRate: '0.00000866',
  },
  TON: {
    name: 'ION',
    decimals: 9,
    shortSymbol: 'ION',
    shortSymbolPosition: 'end',
    fallbackRate: '13238',
  },
};

export const BURN_ADDRESS = 'UQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJKZ';

export const DEFAULT_WALLET_VERSION: ApiTonWalletVersion = 'W5';
export const POPULAR_WALLET_VERSIONS: readonly ApiTonWalletVersion[] = ['v3R1', 'v3R2', 'v4R2', 'W5'];

export const DEFAULT_TIMEOUT = 10000;
export const DEFAULT_RETRIES = 3;
export const DEFAULT_ERROR_PAUSE = 500;

export const BROWSER_HISTORY_LIMIT = 10;

export const NFT_BATCH_SIZE = 4;
export const BURN_CHUNK_DURATION_APPROX_SEC = 30;
export const CLAIM_ADDRESS = 'EQB3zOTvPi1PmwdcTpqSfFKZnhi1GNKEVJM-LdoAirdLtash';
export const CLAIM_AMOUNT = 30000000n; // 0.03 TON
export const CLAIM_COMMENT = 'claim';

export const RE_LINK_TEMPLATE = /((ftp|https?):\/\/)?(?<host>(www\\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z][-a-zA-Z0-9]{1,62})\b([-a-zA-Z0-9()@:%_+.,~#?&/=]*)/g;

export const RE_TG_BOT_MENTION = /(telegram|tg)[:\s-]*@[a-z0-9_]+|(https?:\/\/)?(t\.me|telegram\.me|telegram\.dog)\/[a-z0-9_]+/mi;

export const STARS_SYMBOL = '⭐️';

export const AUTOLOCK_OPTIONS_LIST = [
  {
    value: 'never',
    name: 'Disabled',
    selectedName: 'Disabled',
    period: 0,
  },
  {
    value: '1',
    name: '30 seconds',
    selectedName: 'If away for 30 sec',
    period: 30_000,
  },
  {
    value: '2',
    name: '3 minutes',
    selectedName: 'If away for 3 min',
    period: 60_000 * 3,
  },
  {
    value: '3',
    name: '10 minutes',
    selectedName: 'If away for 10 min',
    period: 60_000 * 10,
  },
] as const;

export const AUTO_CONFIRM_DURATION_MINUTES = 5;

export const PRICELESS_TOKEN_HASHES = new Set([
  '173e31eee054cb0c76f77edc7956bed766bf48a1f63bd062d87040dcd3df700f', // FIVA SY tsTON EQAxGi9Al7hamLAORroxGkvfap6knGyzI50ThkP3CLPLTtOZ
  '5226dd4e6db9af26b24d5ca822bc4053b7e08152f923932abf25030c7e38bb42', // FIVA PT tsTON EQAkxIRGXgs2vD2zjt334MBjD3mXg2GsyEZHfzuYX_trQkFL
  'fea2c08a704e5192b7f37434927170440d445b87aab865c3ea2a68abe7168204', // FIVA YT tsTON EQAcy60qg22RCq87A_qgYK8hooEgjCZ44yxhdnKYdlWIfKXL
  'e691cf9081a8aeb22ed4d94829f6626c9d822752e035800b5543c43f83d134b5', // FIVA LP tsTON EQD3BjCjxuf8mu5kvxajVbe-Ila1ScZZlAi03oS7lMmAJjM3
  '301ce25925830d713b326824e552e962925c4ff45b1e3ea21fc363a459a49b43', // FIVA SY eUSDT EQDi9blCcyT-k8iMpFMYY0t7mHVyiCB50ZsRgyUECJDuGvIl
  '02250f83fbb8624d859c2c045ac70ee2b3b959688c3d843aec773be9b36dbfc3', // FIVA PT eUSDT EQBzVrYkYPHx8D_HPfQacm1xONa4XSRxl826vHkx_laP2HOe
  'dba3adb2c917db80fd71a6a68c1fc9e12976491a8309d5910f9722efc084ce4d', // FIVA YT eUSDT EQCwUSc2qrY5rn9BfFBG9ARAHePTUvITDl97UD0zOreWzLru
  '7da9223b90984d6a144e71611a8d7c65a6298cad734faed79438dc0f7a8e53d1', // FIVA LP eUSDT EQBNlIZxIbQGQ78cXgG3VRcyl8A0kLn_6BM9kabiHHhWC4qY
  'eb9d9891a32ec94425c09735f6ade73f4c171da0091f874d6e9d25247d583990', // Affluent TON Lending Vault EQADQ6JcK0NMuNM5uwCcS9bjcn2RTvcxYIZjNlhIhywUrfBN
  'bca42dbdcbc0d885aaffb1eeeb027d9f338c2dd68701a05641c1d1c3171a7400', // Affluent TON Multiply Vault EQDtxQqkgIRQQR5hWlrQxiJMtLwjR3rEYNUBbEcvPDwCs1Ng
]);

export const STAKED_TOKEN_SLUGS = new Set([
  STAKED_TON_SLUG,
]);

export const DEFAULT_OUR_SWAP_FEE = 0.875;
export const MW_AGGREGATOR_QUERY_ID = '4246015164496276000';

export const DEFAULT_STAKING_STATE: ApiLiquidStakingState = {
  type: 'liquid',
  id: 'liquid',
  tokenSlug: TONCOIN.slug,
  annualYield: 14.09,
  yieldType: 'APY',
  balance: 0n,
  pool: LIQUID_POOL,
  tokenBalance: 0n,
  loyaltyBalance: 0n,
  unstakeRequestAmount: 0n,
  instantAvailable: 0n,
  start: 0,
  end: 0,
  tvl: 0n,
  totalStakers: 0,
};

export const SWAP_API_VERSION = 3;
export const TONCENTER_ACTIONS_VERSION = 'v1';

export const JVAULT_URL = 'https://jvault.xyz';

export const HELP_CENTER_URL = {
  home: {
    en: 'https://help.wallet.ice.io/',
    ru: 'https://help.wallet.ice.io/ru',
  },
  domainScam: {
    en: 'https://help.wallet.ice.io/intro/scams/.ton-domain-scams',
    ru: 'https://help.wallet.ice.io/ru/baza-znanii/moshennichestvo-i-skamy/moshennichestvo-s-ispolzovaniem-domenov-.ton',
  },
  seedScam: {
    en: 'https://help.wallet.ice.io/intro/scams/leaked-seed-phrases',
    ru: 'https://help.wallet.ice.io/ru/baza-znanii/moshennichestvo-i-skamy/slitye-sid-frazy',
  },
};

export const TON_DNS_ZONES = [
  {
    suffixes: ['ton'],
    baseFormat: /^([-\da-z]+\.){0,2}[-\da-z]{4,126}$/i,
    resolver: 'EQC3dNlesgVD8YbAazcauIrXBPfiVhMMr5YYk2in0Mtsz0Bz',
    collectionName: 'TON DNS Domains',
    isRenewable: true,
    isLinkable: true,
  },
  {
    suffixes: ['vip', 'ton.vip', 'vip.ton'],
    baseFormat: /^([-\da-z]+\.){0,2}[\da-z]{1,24}$/i,
    resolver: 'EQBWG4EBbPDv4Xj7xlPwzxd7hSyHMzwwLB5O6rY-0BBeaixS',
    collectionName: 'VIP DNS Domains',
    isRenewable: false,
    isLinkable: true,
  },
  {
    suffixes: ['grm'],
    baseFormat: /^([-\da-z]+\.){0,2}[-\da-z]{1,127}$/i,
    resolver: 'EQAic3zPce496ukFDhbco28FVsKKl2WUX_iJwaL87CBxSiLQ',
    collectionName: 'GRAM DNS Domains',
    isRenewable: false,
    isLinkable: true,
  },
] as const;

export const RENEWABLE_TON_DNS_COLLECTIONS = new Set<string>(
  TON_DNS_ZONES.filter((zone) => zone.isRenewable).map((zone) => zone.resolver),
);

export const DEFAULT_AUTOLOCK_OPTION: AutolockValueType = '3';
export const WRONG_ATTEMPTS_BEFORE_LOG_OUT_SUGGESTION = 2;

export const UNKNOWN_TOKEN = {
  symbol: '[Unknown]',
  decimals: 9,
} as const;

export const DEFAULT_CHAIN: ApiChain = 'ton';
