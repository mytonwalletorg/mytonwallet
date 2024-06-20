import type { URLOpenListenerEvent } from '@capacitor/app';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { StatusBar, Style } from '@capacitor/status-bar';
import { BiometryType, NativeBiometric } from '@capgo/capacitor-native-biometric';
import { NavigationBar } from '@mauricewegner/capacitor-navigation-bar';
import { SafeArea } from 'capacitor-plugin-safe-area';
import { SplashScreen } from 'capacitor-splash-screen';

import type { Theme } from '../global/types';

import { GLOBAL_STATE_CACHE_KEY, IS_CAPACITOR } from '../config';
import * as storageMethods from './capacitorStorageProxy/methods';
import { processDeeplink } from './deeplink';
import { pause } from './schedulers';
import { IS_BIOMETRIC_AUTH_SUPPORTED, IS_DELEGATED_BOTTOM_SHEET, IS_IOS } from './windowEnvironment';

// Full list of options can be found at https://github.com/apache/cordova-plugin-inappbrowser#cordovainappbrowseropen
export const INAPP_BROWSER_OPTIONS = [
  `location=${IS_IOS ? 'no' : 'yes'}`,
  `lefttoright=${IS_IOS ? 'no' : 'yes'}`,
  'usewkwebview=yes',
  'clearcache=no',
  'clearsessioncache=no',
  'hidden=yes',
  'toolbarposition=top',
  'hidenavigationbuttons=yes',
  'hideurlbar=no',
  'backbuttoncaption=Back',
  'allowInlineMediaPlayback=yes',
].join(',');
const IOS_SPLASH_SCREEN_HIDE_DELAY = 500;
const IOS_SPLASH_SCREEN_HIDE_DURATION = 600;
export const VIBRATE_SUCCESS_END_PAUSE_MS = 1300;

let launchUrl: string | undefined;
let platform: 'ios' | 'android' | undefined;
let isNativeBiometricAuthSupported = false;
let isFaceIdAvailable = false;
let isTouchIdAvailable = false;
let statusBarHeight = 0;

export async function initCapacitor() {
  platform = Capacitor.getPlatform() as 'ios' | 'android';

  const biometricsAvailableResult = await NativeBiometric.isAvailable();

  isNativeBiometricAuthSupported = biometricsAvailableResult.isAvailable;
  isFaceIdAvailable = biometricsAvailableResult.biometryType === BiometryType.FACE_ID;
  isTouchIdAvailable = biometricsAvailableResult.biometryType === BiometryType.TOUCH_ID;

  SafeArea.getStatusBarHeight().then(({ statusBarHeight: height }) => {
    statusBarHeight = height;
    document.documentElement.style.setProperty('--status-bar-height', `${height}px`);
  });

  SafeArea.getSafeAreaInsets().then(({ insets: { bottom } }) => {
    document.documentElement.style.setProperty('--safe-area-bottom', `${bottom}px`);
  });

  if (IS_DELEGATED_BOTTOM_SHEET) {
    void SplashScreen.hide({ fadeOutDuration: 0 });
    return;
  }

  if (platform === 'ios') {
    setTimeout(() => {
      void SplashScreen.hide({ fadeOutDuration: IOS_SPLASH_SCREEN_HIDE_DURATION });
    }, IOS_SPLASH_SCREEN_HIDE_DELAY);
  }

  App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
    processDeeplink(event.url);
  });

  App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) {
      window.history.back();
    } else {
      App.exitApp();
    }
  });

  if (platform === 'android') {
    // Until this bug is fixed, the `overlay` must be `false`
    // https://bugs.chromium.org/p/chromium/issues/detail?id=1094366
    void StatusBar.setOverlaysWebView({ overlay: false });
    void NavigationBar.setTransparency({ isTransparent: false });
  }

  await SafeArea.addListener('safeAreaChanged', (data) => {
    const { insets } = data;

    for (const [key, value] of Object.entries(insets)) {
      document.documentElement.style.setProperty(
        `--safe-area-${key}`,
        `${value}px`,
      );
    }
  });

  launchUrl = (await App.getLaunchUrl())?.url;

  if (launchUrl) {
    void processDeeplink(launchUrl);
  }
}

export function switchStatusBar(currentAppTheme: Theme, isSystemDark: boolean, forceDarkBackground?: boolean) {
  if (platform !== 'ios') return;

  const style = forceDarkBackground || currentAppTheme === 'dark'
    ? Style.Dark
    : (isSystemDark && currentAppTheme === 'system' ? Style.Dark : Style.Light);

  void StatusBar.setStyle({ style });
}

export function getLaunchUrl() {
  return launchUrl;
}

export function clearLaunchUrl() {
  launchUrl = undefined;
}

export function getStatusBarHeight() {
  return statusBarHeight;
}

export async function vibrate() {
  if (!IS_CAPACITOR) return;

  await Haptics.impact({ style: ImpactStyle.Light });
}

export async function vibrateOnError() {
  if (!IS_CAPACITOR) return;

  await Haptics.impact({ style: ImpactStyle.Medium });
  await pause(100);
  await Haptics.impact({ style: ImpactStyle.Medium });
  await pause(75);
  await Haptics.impact({ style: ImpactStyle.Light });
}

export async function vibrateOnSuccess(withPauseOnEnd = false) {
  if (!IS_CAPACITOR) return;

  await Haptics.impact({ style: ImpactStyle.Light });

  if (withPauseOnEnd) {
    await pause(VIBRATE_SUCCESS_END_PAUSE_MS);
  }
}

export function getIsNativeBiometricAuthSupported() {
  return isNativeBiometricAuthSupported;
}

export function getIsBiometricAuthSupported() {
  return IS_BIOMETRIC_AUTH_SUPPORTED || getIsNativeBiometricAuthSupported();
}

export function getIsFaceIdAvailable() {
  return isFaceIdAvailable;
}

export function getIsTouchIdAvailable() {
  return isTouchIdAvailable;
}

export async function fixIosAppStorage() {
  await storageMethods.init();

  const isLocalStorageDataExists = Boolean(window.localStorage.getItem(GLOBAL_STATE_CACHE_KEY));
  const isApiStorageDataExists = Boolean(await storageMethods.getItem('accounts'));

  if (isLocalStorageDataExists && !isApiStorageDataExists) {
    window.localStorage.clear();
  }

  if (!isLocalStorageDataExists && isApiStorageDataExists) {
    await storageMethods.clear();
  }
}
