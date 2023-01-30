export const APP_NAME = process.env.APP_NAME || 'MyTonWallet';
export const APP_VERSION = process.env.APP_VERSION!;

export const DEBUG = (
  process.env.APP_ENV !== 'production' && process.env.APP_ENV !== 'perf' && process.env.APP_ENV !== 'test'
);
export const DEBUG_MORE = false;

export const IS_MOCKED_CLIENT = process.env.APP_MOCKED_CLIENT === '1';
export const IS_TEST = process.env.APP_ENV === 'test';
export const IS_PERF = process.env.APP_ENV === 'perf';

export const DEBUG_ALERT_MSG = 'Shoot!\nSomething went wrong, please see the error details in Dev Tools Console.';

export const MNEMONIC_COUNT = 24;
export const MNEMONIC_CHECK_COUNT = 3;

export const MOBILE_SCREEN_MAX_WIDTH = 600; // px
export const MOBILE_SCREEN_LANDSCAPE_MAX_WIDTH = 950; // px
export const MOBILE_SCREEN_LANDSCAPE_MAX_HEIGHT = 450; // px

export const ANIMATED_STICKER_SMALL_SIZE_PX = 110;
export const ANIMATED_STICKER_DEFAULT_PX = 150;
export const ANIMATED_STICKER_BIG_SIZE_PX = 156;

export const DEFAULT_PRICE_CURRENCY = '$';
export const CARD_SECONDARY_VALUE_SYMBOL = 'TON';

export const DEFAULT_DECIMAL_PLACES = 9;

export const TOKEN_INFO = {
  toncoin: {
    name: 'Toncoin',
    symbol: CARD_SECONDARY_VALUE_SYMBOL,
    slug: 'toncoin',
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

export const GLOBAL_STATE_CACHE_DISABLED = false;
export const GLOBAL_STATE_CACHE_KEY = 'mytonwallet-global-state';

export const ANIMATION_LEVEL_MIN = 0;
export const ANIMATION_LEVEL_MED = 1;
export const ANIMATION_LEVEL_MAX = 2;
export const ANIMATION_LEVEL_DEFAULT = ANIMATION_LEVEL_MAX;
export const THEME_DEFAULT = 'system';

export const MAIN_ACCOUNT_ID = '0-ton-mainnet';

export const BRILLIANT_API_BASE_URL = process.env.BRILLIANT_API_BASE_URL || 'https://mytonwallet-api.herokuapp.com';

export const FRACTION_DIGITS = 9;

export const TELEGRAM_WEB_URL = 'https://web.telegram.org/z/';
export const TONSCAN_BASE_MAINNET_URL = 'https://tonscan.org/';
export const TONSCAN_BASE_TESTNET_URL = 'https://testnet.tonscan.org/';
export const GETGEMS_BASE_MAINNET_URL = 'https://getgems.io/';
export const GETGEMS_BASE_TESTNET_URL = 'https://testnet.getgems.io/';

export const TON_TOKEN_SLUG = 'toncoin';

export const PROXY_HOSTS = process.env.PROXY_HOSTS;

export const TINY_TRANSFER_MAX_AMOUNT = 0.01;

export const LANG_CACHE_NAME = 'mtw-lang-5';
export const LANG_PACKS = [{
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
  nativeName: '繁体',
  rtl: false,
}, {
  langCode: 'zh-Hant',
  name: 'Chinese (Traditional)',
  nativeName: '繁體',
  rtl: false,
}];

export const STAKING_CYCLE_DURATION_MS = 129600000; // 36 hours

export const STAKING_POOLS_MAINNET = process.env.STAKING_POOLS_MAINNET
  ? process.env.STAKING_POOLS_MAINNET.split(' ') : [];
export const STAKING_POOLS_TESTNET = process.env.STAKING_POOLS_TESTNET
  ? process.env.STAKING_POOLS_TESTNET.split(' ') : [];
export const STAKING_POOLS_ALL = STAKING_POOLS_MAINNET.concat(STAKING_POOLS_TESTNET);
