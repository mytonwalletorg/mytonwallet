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
    switchTheme(settings.theme, true);
  }

  if (settings.langCode !== prevSettings.langCode) {
    void setLanguage(settings.langCode);
  }

  prevGlobal = global;
});

addActionHandler('setAutolockValue', (global, actions, { value }) => {
  return {
    ...global,
    settings: {
      ...global.settings,
      autolockValue: value,
    },
  };
});
