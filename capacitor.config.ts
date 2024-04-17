import type { CapacitorConfig } from '@capacitor/cli';

const { APP_ENV = 'production' } = process.env;

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
    includePlugins: [
      '@capacitor-mlkit/barcode-scanning',
      '@capacitor/app',
      '@capacitor/clipboard',
      '@capacitor/haptics',
      '@capacitor/action-sheet',
      '@capacitor/status-bar',
      '@capgo/capacitor-native-biometric',
      '@capgo/native-audio',
      '@mauricewegner/capacitor-navigation-bar',
      'capacitor-native-settings',
      'capacitor-plugin-safe-area',
      'cordova-plugin-inappbrowser',
      'native-dialog',
      'native-bottom-sheet',
      'capacitor-secure-storage-plugin',
      '@capacitor/app-launcher',
    ],
    webContentsDebuggingEnabled: APP_ENV !== 'production',
  },
  ios: {
    path: 'mobile/ios',
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
  },
};

export default config;
