import type { ApiBaseCurrency, ApiSwapAsset, ApiWalletVersion } from './api/types';
import type { LangItem, TokenPeriod } from './global/types';

export const APP_ENV = process.env.APP_ENV;

export const APP_NAME = process.env.APP_NAME || 'MyTonWallet';
export const APP_VERSION = process.env.APP_VERSION!;
export const APP_ENV_MARKER = APP_ENV === 'staging' ? 'Beta' : APP_ENV === 'development' ? 'Dev' : undefined;

export const DEBUG = APP_ENV !== 'production' && APP_ENV !== 'perf' && APP_ENV !== 'test';
export const DEBUG_MORE = false;

export const IS_PRODUCTION = APP_ENV === 'production';
export const IS_TEST = APP_ENV === 'test';
export const IS_PERF = APP_ENV === 'perf';
export const IS_EXTENSION = process.env.IS_EXTENSION === '1';
export const IS_FIREFOX_EXTENSION = process.env.IS_FIREFOX_EXTENSION === '1';
export const IS_PACKAGED_ELECTRON = process.env.IS_PACKAGED_ELECTRON === '1';
export const IS_CAPACITOR = process.env.IS_CAPACITOR === '1';
export const IS_ANDROID_DIRECT = process.env.IS_ANDROID_DIRECT === '1';

export const ELECTRON_HOST_URL = 'https://dumb-host';
export const INACTIVE_MARKER = '[Inactive]';
export const PRODUCTION_URL = 'https://mytonwallet.app';
export const BETA_URL = 'https://beta.mytonwallet.app';
export const APP_REPO_URL = 'https://github.com/mytonwalletorg/mytonwallet';
export const BASE_URL = process.env.BASE_URL;

export const SWAP_FEE_ADDRESS = process.env.SWAP_FEE_ADDRESS || 'UQDUkQbpTVIgt7v66-JTFR-3-eXRFz_4V66F-Ufn6vOg0GOp';

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

export const DEFAULT_LANDSCAPE_ACTION_TAB_ID = 0;

export const DEFAULT_DECIMAL_PLACES = 9;

export const DEFAULT_SLIPPAGE_VALUE = 5;

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
export const TONHTTPAPI_V3_MAINNET_API_URL = process.env.TONHTTPAPI_V3_MAINNET_API_KEY
  || 'https://tonhttpapi-v3.mytonwallet.org/api/v3';
export const TONAPIIO_MAINNET_URL = process.env.TONAPIIO_MAINNET_URL || 'https://tonapiio.mytonwallet.org';

export const TONHTTPAPI_TESTNET_URL = process.env.TONHTTPAPI_TESTNET_URL
  || 'https://tonhttpapi-testnet.mytonwallet.org/api/v2/jsonRPC';
export const TONHTTPAPI_TESTNET_API_KEY = process.env.TONHTTPAPI_TESTNET_API_KEY;
export const ELECTRON_TONHTTPAPI_TESTNET_API_KEY = process.env.ELECTRON_TONHTTPAPI_TESTNET_API_KEY;
export const TONHTTPAPI_V3_TESTNET_API_URL = process.env.TONHTTPAPI_V3_TESTNET_API_KEY
  || 'https://tonhttpapi-v3-testnet.mytonwallet.org/api/v3';
export const TONAPIIO_TESTNET_URL = process.env.TONAPIIO_TESTNET_URL || 'https://tonapiio-testnet.mytonwallet.org';

export const BRILLIANT_API_BASE_URL = process.env.BRILLIANT_API_BASE_URL || 'https://api.mytonwallet.org';

export const FRACTION_DIGITS = 9;
export const SHORT_FRACTION_DIGITS = 2;

export const SUPPORT_USERNAME = 'MyTonWalletSupport';
export const SUPPORT_URL = `https://t.me/${SUPPORT_USERNAME}`;
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
export const DEFAULT_SWAP_SECOND_TOKEN_SLUG = 'ton-eqc47093ox'; // To be updated with the most popular token, according to https://ton.app/jettons
export const DEFAULT_CEX_SWAP_SECOND_TOKEN_SLUG = 'usdtrx';

export const PROXY_HOSTS = process.env.PROXY_HOSTS;

export const TINY_TRANSFER_MAX_COST = 0.01;

export const LANG_CACHE_NAME = 'mtw-lang-91';

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
export const VALIDATION_PERIOD_MS = 65536000; // 18.2 h.
export const ONE_TON = 1000000000n;
export const MIN_BALANCE_FOR_UNSTAKE = 1020000000n; // 1.02 TON
export const STAKING_FORWARD_AMOUNT = ONE_TON;
export const DEFAULT_FEE = 15000000n; // 0.015 TON

export const STAKING_POOLS = process.env.STAKING_POOLS ? process.env.STAKING_POOLS.split(' ') : [];
export const LIQUID_POOL = process.env.LIQUID_POOL || 'EQD2_4d91M4TVbEBVyBF8J1UwpMJc361LKVCz6bBlffMW05o';
export const LIQUID_JETTON = process.env.LIQUID_JETTON || 'EQCqC6EhRJ_tpWngKxL6dV0k6DSnRUrs9GSVkLbfdCqsj6TE';
export const STAKING_MIN_AMOUNT = ONE_TON;
export const NOMINATORS_STAKING_MIN_AMOUNT = ONE_TON * 10001n;

export const TONCONNECT_PROTOCOL_VERSION = 2;
export const TONCONNECT_WALLET_JSBRIDGE_KEY = 'mytonwallet';

export const NFT_FRAGMENT_COLLECTIONS = new Set([
  '0:0e41dc1dc3c9067ed24248580e12b3359818d83dee0304fabcf80845eafafdb2', // Anonymous Telegram Numbers
  '0:80d78a35f955a14b679faa887ff4cd5bfc0f43b4a4eea2a7e6927f3701b273c2', // Telegram Usernames
]);

export const TON_DNS_COLLECTION = 'EQC3dNlesgVD8YbAazcauIrXBPfiVhMMr5YYk2in0Mtsz0Bz';

export const TOKEN_INFO = {
  toncoin: {
    name: 'Toncoin',
    symbol: TON_SYMBOL,
    slug: TON_TOKEN_SLUG,
    cmcSlug: TON_TOKEN_SLUG,
    quote: {
      slug: TON_TOKEN_SLUG,
      price: 1.95,
      priceUsd: 1.95,
      percentChange24h: 0,
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
    price: 0,
    priceUsd: 0,
    isPopular: true,
  },
  'ton-eqc47093ox': {
    name: 'Gram',
    symbol: 'GRAM',
    blockchain: TON_BLOCKCHAIN,
    slug: 'ton-eqc47093ox',
    decimals: 9,
    // eslint-disable-next-line max-len
    image: 'https://cache.tonapi.io/imgproxy/lNoY3YdNeBug53ixjK6hxT6XIX3_xoIYNqv-ykIQ1Aw/rs:fill:200:200:1/g:no/aHR0cHM6Ly9ncmFtY29pbi5vcmcvaW1nL2ljb24ucG5n.webp',
    contract: 'EQC47093oX5Xhb0xuk2lCr2RhS8rj-vul61u4W2UH5ORmG_O',
    price: 0,
    priceUsd: 0,
    isPopular: true,
  },
};

export const MULTITAB_DATA_CHANNEL_NAME = 'mtw-multitab';
export const ACTIVE_TAB_STORAGE_KEY = 'mtw-active-tab';

export const INDEXED_DB_NAME = 'keyval-store';
export const INDEXED_DB_STORE_NAME = 'keyval';

export const WINDOW_PROVIDER_CHANNEL = 'windowProvider';

export const MIN_ASSETS_TAB_VIEW = 5;

export const DEFAULT_PRICE_CURRENCY = 'USD';
export const SHORT_CURRENCY_SYMBOL_MAP = {
  USD: '$',
  EUR: '€',
  RUB: '₽',
  CNY: '¥',
};
export const CURRENCY_LIST: { value: ApiBaseCurrency; name: string }[] = [
  {
    value: 'USD',
    name: 'US Dollar',
  }, {
    value: 'EUR',
    name: 'Euro',
  }, {
    value: 'RUB',
    name: 'Ruble',
  }, {
    value: 'CNY',
    name: 'Yuan',
  }, {
    value: 'BTC',
    name: 'Bitcoin',
  }, {
    value: TON_SYMBOL,
    name: 'Toncoin',
  },
];

export const EXCHANGE_ADDRESSES = {
  OKX: [
    'EQBfAN7LfaUYgXZNw5Wc7GBgkEX2yhuJ5ka95J1JJwXXf4a8', 'UQBfAN7LfaUYgXZNw5Wc7GBgkEX2yhuJ5ka95J1JJwXXf9t5',
    'EQCFTsRSHv1SrUO88ZiOTETr35omrRj6Uav9toX8OzSKXGkS', 'UQCFTsRSHv1SrUO88ZiOTETr35omrRj6Uav9toX8OzSKXDTX',
    'EQDn6G2gh0LtkzQ0_-uPCKY8fhAO6ELiX1manL8IkVdKbGzr', 'UQDn6G2gh0LtkzQ0_-uPCKY8fhAO6ELiX1manL8IkVdKbDEu',
    'EQADON7zS4TG7pE0oEqxYBRQvkRjQKN64lneV8s3vbWQzWUO', 'UQADON7zS4TG7pE0oEqxYBRQvkRjQKN64lneV8s3vbWQzTjL',
  ],
  Bitfinex: ['EQBBlxK8VBxEidbxw4oQVyLSk7iEf9VPJxetaRQpEbi-XG4U', 'UQBBlxK8VBxEidbxw4oQVyLSk7iEf9VPJxetaRQpEbi-XDPR'],
  MEXC: ['EQBX63RAdgShn34EAFMV73Cut7Z15lUZd1hnVva68SEl7sxi', 'UQBX63RAdgShn34EAFMV73Cut7Z15lUZd1hnVva68SEl7pGn'],
  ByBit: [
    'EQDD8dqOzaj4zUK6ziJOo_G2lx6qf1TEktTRkFJ7T1c_fPQb', 'UQDD8dqOzaj4zUK6ziJOo_G2lx6qf1TEktTRkFJ7T1c_fKne',
    'EQCuYqGS2pbiZhYacCzJ9t6RwMNEHxfOulG8RC37IDGjCmeU', 'UQCuYqGS2pbiZhYacCzJ9t6RwMNEHxfOulG8RC37IDGjCjpR',
  ],
  Huobi: ['EQBVXzBT4lcTA3S7gxrg4hnl5fnsDKj4oNEzNp09aQxkwj1f', 'UQBVXzBT4lcTA3S7gxrg4hnl5fnsDKj4oNEzNp09aQxkwmCa'],
  KuCoin: ['EQCA1BI4QRZ8qYmskSRDzJmkucGodYRTZCf_b9hckjla6dZl', 'UQCA1BI4QRZ8qYmskSRDzJmkucGodYRTZCf_b9hckjla6Yug'],
  'Telegram Wallet': [
    'EQCkoRp4OE-SFUoMEnYfL3vF43T3AzNfW8jyTC4yzk8cJqMS', 'UQCkoRp4OE-SFUoMEnYfL3vF43T3AzNfW8jyTC4yzk8cJv7X',
    'EQA2JYPGPywx6Sn590nUd06B2HgOkFvJ-cCnTO6yTEdacbUG', 'UQA2JYPGPywx6Sn590nUd06B2HgOkFvJ-cCnTO6yTEdacejD',
    'EQAfWAbHPQO7yW637r8WBn8fLo4nDPoW1XABqp6vdFbwCAb0', 'UQAfWAbHPQO7yW637r8WBn8fLo4nDPoW1XABqp6vdFbwCFsx',
    'EQCXrZNESRUInoEiOP8Qq-kGbQsD6j26KoYw-5yfiKpFXPqY', 'UQCXrZNESRUInoEiOP8Qq-kGbQsD6j26KoYw-5yfiKpFXKdd',
  ],
};
export const EXCHANGE_ADDRESSES_FLAT = new Set(Object.values(EXCHANGE_ADDRESSES).flat());

export const BURN_ADDRESS = 'UQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJKZ';

export const DEFAULT_WALLET_VERSION: ApiWalletVersion = 'v4R2';
export const POPULAR_WALLET_VERSIONS: ApiWalletVersion[] = ['v3R1', 'v3R2', 'v4R2'];

export const DEFAULT_TIMEOUT = 5000;
export const DEFAULT_RETRIES = 3;
export const DEFAULT_ERROR_PAUSE = 200;

export const HISTORY_PERIODS: TokenPeriod[] = ['1D', '7D', '1M', '3M', '1Y', 'ALL'];

export const BROWSER_HISTORY_LIMIT = 10;

export const LEDGER_NFT_TRANSFER_DISABLED = true;
