// @ts-expect-error Import is relative to the original file's location for correct resolution after replacement with NormalModuleReplacementPlugin.
import { getPlatform } from './getPlatform';

export const PLATFORM_ENV = getPlatform();

export const IS_IOS = PLATFORM_ENV === 'iOS';
export const IS_ANDROID = PLATFORM_ENV === 'Android';
export const IS_ELECTRON = Boolean(window.electron);
export const IS_SAFARI = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

export const USER_AGENT_LANG_CODE = 'en';

export const DPR = window.devicePixelRatio || 1;
