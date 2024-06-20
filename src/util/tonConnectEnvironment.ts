import type { DeviceInfo } from '@tonconnect/protocol';

import { APP_NAME, IS_CAPACITOR, TONCONNECT_PROTOCOL_VERSION } from '../config';
import packageJson from '../../package.json';
import { IS_ELECTRON } from './windowEnvironment';

type DevicePlatform = DeviceInfo['platform'];

export function tonConnectGetDeviceInfo(): DeviceInfo {
  return {
    platform: getPlatform()!,
    appName: APP_NAME,
    appVersion: packageJson.version,
    maxProtocolVersion: TONCONNECT_PROTOCOL_VERSION,
    features: [
      'SendTransaction', // TODO DEPRECATED
      { name: 'SendTransaction', maxMessages: 4 },
    ],
  };
}

function getPlatform(): DevicePlatform {
  const { userAgent } = window.navigator;
  const platform = window.navigator.platform || window.navigator?.userAgentData?.platform || '';

  const macosPlatforms = ['macOS', 'Macintosh', 'MacIntel', 'MacPPC', 'Mac68K'];
  const windowsPlatforms = ['Win32', 'Win64', 'Windows', 'WinCE'];
  const iphonePlatforms = ['iPhone'];
  const ipadPlatforms = ['iPad', 'iPod'];

  let devicePlatform: DevicePlatform | undefined;

  if (!IS_CAPACITOR && !IS_ELECTRON) {
    devicePlatform = 'browser';
  } else if (/Android/.test(userAgent)) {
    devicePlatform = 'android';
  } else if (iphonePlatforms.indexOf(platform) !== -1) {
    devicePlatform = 'iphone';
  } else if (ipadPlatforms.indexOf(platform) !== -1) {
    devicePlatform = 'ipad';
  } else if (macosPlatforms.indexOf(platform) !== -1) {
    devicePlatform = 'mac';
  } else if (windowsPlatforms.indexOf(platform) !== -1) {
    devicePlatform = 'windows';
  } else if (/Linux/.test(platform)) {
    devicePlatform = 'linux';
  } else {
    devicePlatform = 'browser';
  }

  return devicePlatform;
}
