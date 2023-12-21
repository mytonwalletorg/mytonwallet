import { registerPlugin } from '@capacitor/core';

import type { SplashScreenPlugin } from './definitions';

const SplashScreen = registerPlugin<SplashScreenPlugin>('SplashScreen', {
  web: () => import('./web').then(m => new m.SplashScreenWeb()),
});

export * from './definitions';
export { SplashScreen };
