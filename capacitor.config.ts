import type { CapacitorConfig } from '@capacitor/cli';

const { APP_ENV = 'production' } = process.env;

const COMMON_PLUGINS = [
  '@capacitor-community/bluetooth-le',
  '@capacitor-mlkit/barcode-scanning',
  '@capacitor/app',
  '@capacitor/app-launcher',
  '@capacitor/clipboard',
  '@capacitor/filesystem',
  '@capacitor/haptics',
  '@capacitor/push-notifications',
  '@capacitor/share',
  '@capgo/capacitor-native-biometric',
  '@capgo/native-audio',
  '@mauricewegner/capacitor-navigation-bar',
  '@sina_kh/mtw-capacitor-status-bar',
  'capacitor-native-settings',
  'capacitor-plugin-safe-area',
  'capacitor-secure-storage-plugin',
  'cordova-plugin-inappbrowser',
  'mtw-capacitor-usb-hid',
  'native-bottom-sheet',
  'native-dialog',
];

const IOS_PLUGINS = [
  '@sina_kh/mtw-capacitor-splash-screen',
];

const ANDROID_PLUGINS = [
  '@capacitor/keyboard',
];

const config: CapacitorConfig = {
  appId: 'org.mytonwallet.app',
  appName: 'MyTonWallet',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    hostname: 'mytonwallet.local',
  },
  android: {
    path: 'mobile/android',
    includePlugins: COMMON_PLUGINS.concat(ANDROID_PLUGINS),
    webContentsDebuggingEnabled: APP_ENV !== 'production',
  },
  ios: {
    path: 'mobile/ios',
    includePlugins: COMMON_PLUGINS.concat(IOS_PLUGINS),
    scheme: 'MyTonWallet',
    webContentsDebuggingEnabled: APP_ENV !== 'production',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
    },
    CapacitorHttp: {
      enabled: true,
    },
    PushNotifications: {
      presentationOptions: [],
    },
  },
};

export default config;
