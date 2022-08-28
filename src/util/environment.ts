import {
  MOBILE_SCREEN_MAX_WIDTH,
  MOBILE_SCREEN_LANDSCAPE_MAX_HEIGHT,
  MOBILE_SCREEN_LANDSCAPE_MAX_WIDTH,
} from '../config';

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

export const PLATFORM_ENV = getPlatform();
export const IS_MAC_OS = PLATFORM_ENV === 'macOS';
export const IS_IOS = PLATFORM_ENV === 'iOS';
export const IS_ANDROID = PLATFORM_ENV === 'Android';
export const IS_SAFARI = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
export const IS_TOUCH_ENV = window.matchMedia('(pointer: coarse)').matches;
export const IS_EXTENSION = Boolean(window.chrome && chrome.runtime && chrome.runtime.id);

// Keep in mind the landscape orientation
export const IS_SINGLE_COLUMN_LAYOUT = window.innerWidth <= MOBILE_SCREEN_MAX_WIDTH || (
  window.innerWidth <= MOBILE_SCREEN_LANDSCAPE_MAX_WIDTH && window.innerHeight <= MOBILE_SCREEN_LANDSCAPE_MAX_HEIGHT
);

export const DPR = window.devicePixelRatio || 1;
