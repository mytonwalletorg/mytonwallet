import { requestMutation } from '../lib/fasterdom/fasterdom';

import type { LangCode } from '../global/types';

import { IS_ELECTRON, LANG_LIST } from '../config';

const SAFE_AREA_INITIALIZATION_DELAY = 1000;

export function getPlatform() {
  const { userAgent, platform } = window.navigator;

  const iosPlatforms = ['iPhone', 'iPad', 'iPod'];
  if (
    iosPlatforms.indexOf(platform) !== -1
    // For new IPads with M1 chip and IPadOS platform returns "MacIntel"
    || (platform === 'MacIntel' && ('maxTouchPoints' in navigator && navigator.maxTouchPoints > 2))
  ) return 'iOS';

  const macosPlatforms = ['Macintosh', 'MacIntel', 'MacPPC', 'Mac68K'];
  if (macosPlatforms.indexOf(platform) !== -1) return 'macOS';

  const windowsPlatforms = ['Win32', 'Win64', 'Windows', 'WinCE'];
  if (windowsPlatforms.indexOf(platform) !== -1) return 'Windows';

  if (/Android/.test(userAgent)) return 'Android';

  if (/Linux/.test(platform)) return 'Linux';

  return undefined;
}

function getBrowserLanguage(): LangCode {
  const lang = navigator.language.startsWith('zh')
    ? (navigator.language.endsWith('TW') || navigator.language.endsWith('HK') ? 'zh-Hant' : 'zh-Hans')
    : navigator.language.substring(0, 2);

  return (LANG_LIST.some(({ langCode }) => langCode === lang) ? lang : 'en') as LangCode;
}

export const PLATFORM_ENV = getPlatform();
export const IS_MAC_OS = PLATFORM_ENV === 'macOS';
export const IS_WINDOWS = PLATFORM_ENV === 'Windows';
export const IS_LINUX = PLATFORM_ENV === 'Linux';
export const IS_IOS = PLATFORM_ENV === 'iOS';
export const IS_ANDROID = PLATFORM_ENV === 'Android';
export const IS_SAFARI = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
export const IS_TOUCH_ENV = window.matchMedia('(pointer: coarse)').matches;
export const IS_EXTENSION = Boolean(window.chrome && chrome.runtime && chrome.runtime.id);
export const IS_CHROME_EXTENSION = Boolean(window.chrome?.system);
export const IS_FIREFOX_EXTENSION = IS_EXTENSION && !IS_CHROME_EXTENSION;
export const DEFAULT_LANG_CODE = 'en';
export const USER_AGENT_LANG_CODE = getBrowserLanguage();
export const DPR = window.devicePixelRatio || 1;
export const IS_DAPP_SUPPORTED = IS_ELECTRON || IS_EXTENSION;
export const IS_LEDGER_SUPPORTED = !(IS_IOS || IS_ANDROID || IS_FIREFOX_EXTENSION);

export function setScrollbarWidthProperty() {
  const el = document.createElement('div');
  el.style.cssText = 'overflow-x: hidden; overflow-y: scroll; visibility:hidden; position:absolute;';
  el.classList.add('custom-scroll');
  document.body.appendChild(el);
  const width = el.offsetWidth - el.clientWidth;
  el.remove();

  document.documentElement.style.setProperty('--scrollbar-width', `${width}px`);

  return width;
}

export function setPageSafeAreaProperty() {
  const { documentElement } = document;

  // WebKit has issues with this property on page load
  // https://bugs.webkit.org/show_bug.cgi?id=191872
  setTimeout(() => {
    const safeAreaBottom = parseInt(getComputedStyle(documentElement).getPropertyValue('--safe-area-bottom-value'), 10);

    if (!Number.isNaN(safeAreaBottom) && safeAreaBottom > 0) {
      requestMutation(() => {
        documentElement.classList.add('with-safe-area-bottom');
      });
    }
  }, SAFE_AREA_INITIALIZATION_DELAY);
}

export const REM = parseInt(getComputedStyle(document.documentElement).fontSize, 10);
