import type { CapacitorConfig } from '@capacitor/cli';

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
      '@capacitor/dialog',
      '@capacitor/haptics',
      '@capacitor/action-sheet',
      '@capacitor/status-bar',
      '@capgo/capacitor-native-biometric',
      '@capgo/native-audio',
      '@mauricewegner/capacitor-navigation-bar',
      'capacitor-plugin-safe-area',
      'cordova-plugin-inappbrowser',
      'native-bottom-sheet',
      'capacitor-secure-storage-plugin',
    ],
  },
  ios: {
    path: 'mobile/ios',
    scheme: 'MyTonWallet',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
    },
  },
};

export default config;
