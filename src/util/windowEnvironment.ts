import type { LangCode } from '../global/types';

import {
  IS_CAPACITOR, IS_EXTENSION, IS_FIREFOX_EXTENSION, LANG_LIST,
} from '../config';
import { requestForcedReflow } from '../lib/fasterdom/fasterdom';
import { getPlatform } from './getPlatform';

function isIPad() {
  const { userAgent, platform } = window.navigator;
  return platform === 'iPad'
    || userAgent.includes('iPad')
    || (platform === 'MacIntel' && ('maxTouchPoints' in navigator && navigator.maxTouchPoints > 2));
}

function getBrowserLanguage(): LangCode {
  const { language } = navigator;
  const lang = language.startsWith('zh')
    ? (language.endsWith('TW') || language.endsWith('HK') ? 'zh-Hant' : 'zh-Hans')
    : language.substring(0, 2);

  return (LANG_LIST.some(({ langCode }) => langCode === lang) ? lang : 'en') as LangCode;
}

export const IS_PWA = (
  window.matchMedia('(display-mode: standalone)').matches
  || (window.navigator as any).standalone
  || document.referrer.includes('android-app://')
);

export const PLATFORM_ENV = getPlatform();
export const IS_MAC_OS = PLATFORM_ENV === 'macOS';
export const IS_WINDOWS = PLATFORM_ENV === 'Windows';
export const IS_LINUX = PLATFORM_ENV === 'Linux';
export const IS_IOS = PLATFORM_ENV === 'iOS';
export const IS_ANDROID = PLATFORM_ENV === 'Android';
export const IS_SAFARI = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
export const IS_OPERA = navigator.userAgent.includes(' OPR/');
export const IS_EDGE = navigator.userAgent.includes(' Edg/');
export const IS_FIREFOX = navigator.userAgent.includes('Firefox/');
export const IS_TOUCH_ENV = window.matchMedia('(pointer: coarse)').matches;
export const IS_CHROME_EXTENSION = Boolean(window.chrome?.system);
export const IS_ELECTRON = Boolean(window.electron);
export const IS_WEB = !IS_CAPACITOR && !IS_ELECTRON && !IS_EXTENSION;
export const DEFAULT_LANG_CODE = 'en';
export const USER_AGENT_LANG_CODE = getBrowserLanguage();
export const DPR = window.devicePixelRatio || 1;
export const IS_LEDGER_SUPPORTED = IS_CAPACITOR || !(IS_IOS || IS_FIREFOX_EXTENSION);
export const IS_LEDGER_EXTENSION_TAB = global.location.hash.startsWith('#detached');
// Disable biometric auth on electron for now until this issue is fixed:
// https://github.com/electron/electron/issues/24573
export const IS_BIOMETRIC_AUTH_SUPPORTED = Boolean(
  !IS_CAPACITOR && window.navigator.credentials && (!IS_ELECTRON || IS_MAC_OS),
);
export const IS_DELEGATED_BOTTOM_SHEET = IS_CAPACITOR && global.location.search.startsWith('?bottom-sheet');
export const IS_DELEGATING_BOTTOM_SHEET = IS_CAPACITOR && IS_IOS && !IS_DELEGATED_BOTTOM_SHEET && !isIPad();
export const IS_MULTITAB_SUPPORTED = 'BroadcastChannel' in window && !IS_LEDGER_EXTENSION_TAB;
export const IS_DAPP_SUPPORTED = IS_EXTENSION || IS_ELECTRON || IS_CAPACITOR;
export const IS_IOS_APP = IS_IOS && IS_CAPACITOR;
export const IS_ANDROID_APP = IS_ANDROID && IS_CAPACITOR;

export function setScrollbarWidthProperty() {
  const el = document.createElement('div');
  el.style.cssText = 'overflow-x: hidden; overflow-y: scroll; visibility:hidden; position:absolute;';
  el.classList.add('custom-scroll');
  document.body.appendChild(el);

  requestForcedReflow(() => {
    const width = el.offsetWidth - el.clientWidth;

    return () => {
      document.documentElement.style.setProperty('--scrollbar-width', `${width}px`);
      el.remove();
    };
  });
}

export const REM = parseInt(getComputedStyle(document.documentElement).fontSize, 10);
export const STICKY_CARD_INTERSECTION_THRESHOLD = -3.75 * REM;
