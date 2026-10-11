import type { LangCode } from '../global/types';

import {
  IS_CAPACITOR, IS_EXTENSION, IS_FIREFOX_EXTENSION, LANG_LIST, LEGACY_APP_HOSTS,
} from '../config';
import { requestForcedReflow } from '../lib/fasterdom/fasterdom';
import { getPlatform } from './getPlatform';

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
export const IS_LEGACY_APP_HOST = IS_WEB && LEGACY_APP_HOSTS.includes(window.location.hostname);
// On the deprecated host, new-wallet creation is hidden to steer newcomers to the current site. `?old-but-gold` is
// an escape hatch that brings the button back (support and testing on the old domain).
export const IS_NEW_WALLET_CREATION_HIDDEN = IS_LEGACY_APP_HOST
  && !new URLSearchParams(window.location.search).has('old-but-gold');
export const DEFAULT_LANG_CODE = 'en';
export let USER_AGENT_LANG_CODE = getBrowserLanguage();
export function setUserAgentLangCode(langCode: LangCode) {
  USER_AGENT_LANG_CODE = langCode;
}
export const DPR = window.devicePixelRatio || 1;
// Disable biometric auth on electron for now until this issue is fixed:
// https://github.com/electron/electron/issues/24573
export const IS_BIOMETRIC_AUTH_SUPPORTED = Boolean(
  !IS_CAPACITOR && window.navigator.credentials && (!IS_ELECTRON || IS_MAC_OS),
);
export const CAN_AUTHENTICATE_WITH_BIOMETRIC_ONLY = IS_BIOMETRIC_AUTH_SUPPORTED;
export const IS_DAPP_SUPPORTED = IS_EXTENSION || IS_ELECTRON || IS_CAPACITOR;
export const IS_IOS_APP = IS_IOS && IS_CAPACITOR;
export const IS_ANDROID_APP = IS_ANDROID && IS_CAPACITOR;
export const IS_VIEW_TRANSITION_SUPPORTED = typeof document.startViewTransition === 'function';

// Firefox extensions require `clipboardRead` permission to read data.
export const IS_CLIPBOARDS_SUPPORTED = !IS_FIREFOX_EXTENSION && getIsClipboardReadTextSupported();

export const REM = parseInt(getComputedStyle(document.documentElement).fontSize, 10);
export const STICKY_CARD_INTERSECTION_THRESHOLD = -3 * REM;

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

function getIsClipboardReadTextSupported() {
  return (
    typeof navigator !== 'undefined'
    && 'clipboard' in navigator
    && typeof navigator.clipboard?.readText === 'function'
  );
}
