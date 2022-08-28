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

export const DEFAULT_PRICE_CURRENCY = '$';
export const CARD_SECONDARY_VALUE_SYMBOL = 'TON';

export const TOKEN_INFO = {
  toncoin: {
    name: 'Toncoin',
    symbol: 'TON',
    slug: 'toncoin',
    quote: {
      price: 1.95,
      percentChange1h: 0,
      percentChange24h: 0,
      percentChange7d: 0,
      percentChange30d: 0,
    },
  },
};

export const GLOBAL_STATE_CACHE_DISABLED = false;
export const GLOBAL_STATE_CACHE_KEY = 'mytonwallet-global-state';

export const IS_TESTNET = false;

export const ANIMATION_LEVEL_MIN = 0;
export const ANIMATION_LEVEL_MED = 1;
export const ANIMATION_LEVEL_MAX = 2;
export const ANIMATION_LEVEL_DEFAULT = ANIMATION_LEVEL_MAX;

export const MAIN_ACCOUNT_ID = '0';

export const BRILLIANT_API_BASE_URL = process.env.BRILLIANT_API_BASE_URL || 'https://mytonwallet-api.herokuapp.com';

export const FRACTION_DIGITS = 9;

export const TELEGRAM_WEB_URL = 'https://web.telegram.org/z/';

export const TON_TOKEN_SLUG = 'toncoin';

export const TRANSACTIONS_SLICE = 100;

export const PROXY = process.env.PROXY;
