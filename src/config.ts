import type { ApiSwapAsset } from './api/types';
import type { LangItem } from './global/types';

export const APP_ENV = process.env.APP_ENV;

export const APP_NAME = process.env.APP_NAME || 'MyTonWallet';
export const APP_VERSION = process.env.APP_VERSION!;
export const APP_ENV_MARKER = APP_ENV === 'staging' ? 'Beta' : APP_ENV === 'development' ? 'Dev' : undefined;

export const DEBUG = APP_ENV !== 'production' && APP_ENV !== 'perf' && APP_ENV !== 'test';
export const DEBUG_MORE = false;

export const IS_TEST = APP_ENV === 'test';
export const IS_PERF = APP_ENV === 'perf';
export const IS_EXTENSION = process.env.IS_EXTENSION === '1';
export const IS_FIREFOX_EXTENSION = process.env.IS_FIREFOX_EXTENSION === '1';
export const IS_PACKAGED_ELECTRON = process.env.IS_PACKAGED_ELECTRON === '1';
export const IS_CAPACITOR = process.env.IS_CAPACITOR === '1';

export const ELECTRON_HOST_URL = 'https://dumb-host';
export const INACTIVE_MARKER = '[Inactive]';
export const PRODUCTION_URL = 'https://mytonwallet.app';
export const BETA_URL = 'https://beta.mytonwallet.app';
export const BASE_URL = process.env.BASE_URL;

export const STRICTERDOM_ENABLED = DEBUG && !IS_PACKAGED_ELECTRON;

export const DEBUG_ALERT_MSG = 'Shoot!\nSomething went wrong, please see the error details in Dev Tools Console.';

export const PIN_LENGTH = 4;
export const NATIVE_BIOMETRICS_USERNAME = 'MyTonWallet';
export const NATIVE_BIOMETRICS_SERVER = 'https://mytonwallet.app';

export const MNEMONIC_COUNT = 24;
export const MNEMONIC_CHECK_COUNT = 3;

export const MOBILE_SCREEN_MAX_WIDTH = 700; // px

export const ANIMATION_END_DELAY = 50;

export const ANIMATED_STICKER_TINY_SIZE_PX = 70;
export const ANIMATED_STICKER_SMALL_SIZE_PX = 110;
export const ANIMATED_STICKER_MIDDLE_SIZE_PX = 120;
export const ANIMATED_STICKER_DEFAULT_PX = 150;
export const ANIMATED_STICKER_BIG_SIZE_PX = 156;
export const ANIMATED_STICKER_HUGE_SIZE_PX = 192;

export const TON_SYMBOL = 'TON';

export const DEFAULT_LANDSCAPE_ACTION_TAB_ID = 1;

export const DEFAULT_DECIMAL_PLACES = 9;

export const DEFAULT_SLIPPAGE_VALUE = 0.5;

export const GLOBAL_STATE_CACHE_DISABLED = false;
export const GLOBAL_STATE_CACHE_KEY = 'mytonwallet-global-state';

export const ANIMATION_LEVEL_MIN = 0;
export const ANIMATION_LEVEL_MED = 1;
export const ANIMATION_LEVEL_MAX = 2;
export const ANIMATION_LEVEL_DEFAULT = ANIMATION_LEVEL_MAX;
export const THEME_DEFAULT = 'system';

export const MAIN_ACCOUNT_ID = '0-ton-mainnet';

export const TONHTTPAPI_MAINNET_URL = process.env.TONHTTPAPI_MAINNET_URL
  || 'https://tonhttpapi.mytonwallet.org/api/v2/jsonRPC';
export const TONHTTPAPI_MAINNET_API_KEY = process.env.TONHTTPAPI_MAINNET_API_KEY;
export const ELECTRON_TONHTTPAPI_MAINNET_API_KEY = process.env.ELECTRON_TONHTTPAPI_MAINNET_API_KEY;
export const TONINDEXER_MAINNET_URL = process.env.TONINDEXER_MAINNET_URL || 'https://tonhttpapi.mytonwallet.org/api/v3';
export const TONAPIIO_MAINNET_URL = process.env.TONAPIIO_MAINNET_URL || 'https://tonapiio.mytonwallet.org';

export const TONHTTPAPI_TESTNET_URL = process.env.TONHTTPAPI_TESTNET_URL
  || 'https://tonhttpapi-testnet.mytonwallet.org/api/v2/jsonRPC';
export const TONHTTPAPI_TESTNET_API_KEY = process.env.TONHTTPAPI_TESTNET_API_KEY;
export const ELECTRON_TONHTTPAPI_TESTNET_API_KEY = process.env.ELECTRON_TONHTTPAPI_TESTNET_API_KEY;
export const TONINDEXER_TESTNET_URL = process.env.TONINDEXER_TESTNET_URL
  || 'https://tonhttpapi-testnet.mytonwallet.org/api/v3';
export const TONAPIIO_TESTNET_URL = process.env.TONAPIIO_TESTNET_URL || 'https://tonapiio-testnet.mytonwallet.org';

export const BRILLIANT_API_BASE_URL = process.env.BRILLIANT_API_BASE_URL || 'https://mytonwallet-api.herokuapp.com';

export const FRACTION_DIGITS = 9;
export const SHORT_FRACTION_DIGITS = 2;

export const MY_TON_WALLET_PROMO_URL = 'https://mytonwallet.io';
export const TELEGRAM_WEB_URL = 'https://web.telegram.org/a/';
export const TONSCAN_BASE_MAINNET_URL = 'https://tonscan.org/';
export const TONSCAN_BASE_TESTNET_URL = 'https://testnet.tonscan.org/';
export const GETGEMS_BASE_MAINNET_URL = 'https://getgems.io/';
export const GETGEMS_BASE_TESTNET_URL = 'https://testnet.getgems.io/';

export const CHANGELLY_SUPPORT_EMAIL = 'support@changelly.com';
export const CHANGELLY_SECURITY_EMAIL = 'security@changelly.com';
export const CHANGELLY_TERMS_OF_USE = 'https://changelly.com/terms-of-use';
export const CHANGELLY_PRIVACY_POLICY = 'https://changelly.com/privacy-policy';
export const CHANGELLY_AML_KYC = 'https://changelly.com/aml-kyc';
export const CHANGELLY_WAITING_DEADLINE = 3 * 60 * 60 * 1000; // 3 hour

export const TON_TOKEN_SLUG = 'toncoin';
export const JWBTC_TOKEN_SLUG = 'ton-eqdcbkghmc';
export const JUSDT_TOKEN_SLUG = 'ton-eqbynbo23y';

export const PROXY_HOSTS = process.env.PROXY_HOSTS;

export const TINY_TRANSFER_MAX_COST = 0.01;

export const LANG_CACHE_NAME = 'mtw-lang-57';

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
}];

export const STAKING_CYCLE_DURATION_MS = 131072000; // 36.4 hours
export const MIN_BALANCE_FOR_UNSTAKE = 1.02;
export const STAKING_FORWARD_AMOUNT = 1;
export const DEFAULT_FEE = 0.01;

export const STAKING_POOLS = process.env.STAKING_POOLS ? process.env.STAKING_POOLS.split(' ') : [];
export const LIQUID_POOL = process.env.LIQUID_POOL || 'EQD2_4d91M4TVbEBVyBF8J1UwpMJc361LKVCz6bBlffMW05o';
export const LIQUID_JETTON = process.env.LIQUID_JETTON || 'EQCqC6EhRJ_tpWngKxL6dV0k6DSnRUrs9GSVkLbfdCqsj6TE';
export const STAKING_MIN_AMOUNT = 1;

export const TON_PROTOCOL = 'ton://';
export const TONCONNECT_PROTOCOL = 'tc://';
export const TONCONNECT_UNIVERSAL_URL = 'https://connect.mytonwallet.org';

export const TOKEN_INFO = {
  toncoin: {
    name: 'Toncoin',
    symbol: TON_SYMBOL,
    slug: TON_TOKEN_SLUG,
    cmcSlug: TON_TOKEN_SLUG,
    quote: {
      price: 1.95,
      percentChange1h: 0,
      percentChange24h: 0,
      percentChange7d: 0,
      percentChange30d: 0,
    },
    decimals: DEFAULT_DECIMAL_PLACES,
  },
};

export const TON_BLOCKCHAIN = 'ton';

export const INIT_SWAP_ASSETS: Record<string, ApiSwapAsset> = {
  toncoin: {
    name: 'Toncoin',
    symbol: TON_SYMBOL,
    blockchain: TON_BLOCKCHAIN,
    slug: TON_TOKEN_SLUG,
    decimals: DEFAULT_DECIMAL_PLACES,
    isPopular: true,
  },
  'ton-eqdcbkghmc': {
    name: 'jWBTC',
    symbol: 'jWBTC',
    blockchain: TON_BLOCKCHAIN,
    slug: 'ton-eqdcbkghmc',
    decimals: 8,
    // eslint-disable-next-line max-len
    image: 'https://cache.tonapi.io/imgproxy/LaFKdzahVX9epWT067gyVLd8aCa1lFrZd7Rp9siViEE/rs:fill:200:200:1/g:no/aHR0cHM6Ly9icmlkZ2UudG9uLm9yZy90b2tlbi8xLzB4MjI2MGZhYzVlNTU0MmE3NzNhYTQ0ZmJjZmVkZjdjMTkzYmMyYzU5OS5wbmc.webp',
    contract: 'EQDcBkGHmC4pTf34x3Gm05XvepO5w60DNxZ-XT4I6-UGG5L5',
    isPopular: false,
    keywords: ['bitcoin'],
  },
};

export const MULTITAB_DATA_CHANNEL_NAME = 'mtw-multitab';
export const ACTIVE_TAB_STORAGE_KEY = 'mtw-active-tab';

export const INDEXED_DB_NAME = 'keyval-store';
export const INDEXED_DB_STORE_NAME = 'keyval';

export const MIN_ASSETS_TAB_VIEW = 5;

export const DEFAULT_PRICE_CURRENCY = 'USD';
export const SHORT_CURRENCY_SYMBOL_MAP = {
  USD: '$',
  EUR: '€',
  RUB: '₽',
  CNY: '¥',
};
