import type { DeviceInfo } from '@tonconnect/protocol';

import packageJson from '../../package.json';

type DevicePlatform = DeviceInfo['platform'];

export const TONCONNECT_VERSION = 2;

export function tonConnectGetDeviceInfo(): DeviceInfo {
  return {
    platform: getPlatform()!,
    appName: 'MyTonWallet',
    appVersion: packageJson.version,
    maxProtocolVersion: TONCONNECT_VERSION,
    features: [
      'SendTransaction', // TODO DEPRECATED
      { name: 'SendTransaction', maxMessages: 4 },
    ],
  };
}

function getPlatform(): DevicePlatform {
  const { userAgent, platform } = window.navigator;

  const macosPlatforms = ['macOS', 'Macintosh', 'MacIntel', 'MacPPC', 'Mac68K'];
  const windowsPlatforms = ['Win32', 'Win64', 'Windows', 'WinCE'];
  const iphonePlatforms = ['iPhone'];
  const ipadPlatforms = ['iPad', 'iPod'];

  let os: DevicePlatform | undefined;

  if (macosPlatforms.indexOf(platform) !== -1) {
    os = 'mac';
  } else if (iphonePlatforms.indexOf(platform) !== -1) {
    os = 'iphone';
  } else if (ipadPlatforms.indexOf(platform) !== -1) {
    os = 'ipad';
  } else if (windowsPlatforms.indexOf(platform) !== -1) {
    os = 'windows';
  } else if (/Android/.test(userAgent)) {
    os = 'linux';
  } else if (/Linux/.test(platform)) {
    os = 'linux';
  }

  return os!;
}
