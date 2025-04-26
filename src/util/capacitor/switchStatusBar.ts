import { StatusBar, Style } from '@capacitor/status-bar';
import { NavigationBar } from '@mauricewegner/capacitor-navigation-bar';

import type { Theme } from '../../global/types';

import {
  IS_ANDROID_APP,
} from '../windowEnvironment';

export function switchStatusBar(
  currentAppTheme: Theme, isSystemDark: boolean, forceDarkBackground?: boolean, isModalOpen?: boolean,
) {
  const style = forceDarkBackground || currentAppTheme === 'dark'
    ? Style.Dark
    : (isSystemDark && currentAppTheme === 'system' ? Style.Dark : Style.Light);

  void StatusBar.setStyle({ style, isModalOpen });
  if (IS_ANDROID_APP) {
    void NavigationBar.setColor({
      color: '#00000000',
      darkButtons: currentAppTheme === 'light' || (!isSystemDark && currentAppTheme === 'system'),
    });
  }
}
