import type { LangCode } from '../global/types';

import { LANG_LIST } from '../config';

export function getPlatform() {
  const { userAgent, platform } = window.navigator;
  const macosPlatforms = ['Macintosh', 'MacIntel', 'MacPPC', 'Mac68K'];
  const windowsPlatforms = ['Win32', 'Win64', 'Windows', 'WinCE'];
  const iosPlatforms = ['iPhone', 'iPad', 'iPod'];
  let os: 'macOS' | 'iOS' | 'Windows' | 'Android' | 'Linux' | undefined;

  if (macosPlatforms.indexOf(platform) !== -1) {
    os = 'macOS';
  } else if (iosPlatforms.indexOf(platform) !== -1) {
    os = 'iOS';
  } else if (windowsPlatforms.indexOf(platform) !== -1) {
    os = 'Windows';
  } else if (/Android/.test(userAgent)) {
    os = 'Android';
  } else if (/Linux/.test(platform)) {
    os = 'Linux';
  }

  return os;
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
export const DEFAULT_LANG_CODE = 'en';
export const USER_AGENT_LANG_CODE = getBrowserLanguage();
export const DPR = window.devicePixelRatio || 1;
