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
      '@capacitor/dialog',
      '@capacitor/haptics',
      '@capacitor/status-bar',
      '@capgo/capacitor-native-biometric',
      '@mauricewegner/capacitor-navigation-bar',
      'capacitor-plugin-safe-area',
      'native-bottom-sheet',
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
