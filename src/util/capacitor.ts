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

import { callApi } from '../api';
import { isTonConnectDeeplink } from './ton/deeplinks';
import { pause } from './schedulers';
import { tonConnectGetDeviceInfo } from './tonConnectEnvironment';
import { IS_BIOMETRIC_AUTH_SUPPORTED, IS_DELEGATED_BOTTOM_SHEET } from './windowEnvironment';

let launchUrl: string | undefined;
const IOS_SPLASH_SCREEN_HIDE_DELAY = 500;
const IOS_SPLASH_SCREEN_HIDE_DURATION = 600;
export const VIBRATE_SUCCESS_END_PAUSE_MS = 1300;

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

  launchUrl = (await App.getLaunchUrl())?.url;

  App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
    processDeeplink(event.url);
  });

  if (launchUrl) {
    void processDeeplink(launchUrl);
  }

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
}

export async function processDeeplink(url: string) {
  if (isTonConnectDeeplink(url)) {
    const deviceInfo = tonConnectGetDeviceInfo();
    const returnStrategy = await callApi('startSseConnection', url, deviceInfo);
    if (returnStrategy === 'ret') {
      await App.minimizeApp();
    }
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

export function getCapacitorPlatform() {
  return platform;
}

export function getStatusBarHeight() {
  return statusBarHeight;
}

export async function vibrate() {
  await Haptics.impact({ style: ImpactStyle.Light });
}

export async function vibrateOnError() {
  for (let i = 0; i < 3; i++) {
    await Haptics.impact({ style: ImpactStyle.Medium });
    await pause(150);
  }
}

export async function vibrateOnSuccess(withPauseOnEnd = false) {
  await pause(300);
  await Haptics.impact({ style: ImpactStyle.Heavy });
  await pause(150);
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
