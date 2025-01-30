import { addCallback } from '../../../lib/teact/teactn';

import type { GlobalState } from '../../types';

import { setLanguage } from '../../../util/langProvider';
import switchTheme from '../../../util/switchTheme';
import { addActionHandler } from '../..';

let prevGlobal: GlobalState | undefined;

addCallback((global: GlobalState) => {
  if (!prevGlobal) {
    prevGlobal = global;
    return;
  }

  const { settings: prevSettings } = prevGlobal;
  const { settings } = global;

  if (settings.theme !== prevSettings.theme) {
    switchTheme(settings.theme);
  }

  if (settings.langCode !== prevSettings.langCode) {
    void setLanguage(settings.langCode);
  }

  prevGlobal = global;
});

addActionHandler('setAppLockValue', (global, actions, { value, isEnabled }) => {
  return {
    ...global,
    settings: {
      ...global.settings,
      autolockValue: value,
      isAppLockEnabled: isEnabled,
    },
  };
});

addActionHandler('setIsManualLockActive', (global, actions, { isActive, shouldHideBiometrics }) => {
  return {
    ...global,
    isManualLockActive: isActive,
    appLockHideBiometrics: shouldHideBiometrics,
  };
});
