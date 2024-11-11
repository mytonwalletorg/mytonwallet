import './global/actions';
import './global/init';
import './util/handleError';
import './util/bigintPatch';

import React from './lib/teact/teact';
import TeactDOM from './lib/teact/teact-dom';
import { getActions, getGlobal } from './global';

import {
  DEBUG, IS_CAPACITOR, STRICTERDOM_ENABLED,
} from './config';
import { requestMutation } from './lib/fasterdom/fasterdom';
import { enableStrict } from './lib/fasterdom/stricterdom';
import { betterView } from './util/betterView';
import { fixIosAppStorage, initCapacitor } from './util/capacitor';
import { initElectron } from './util/electron';
import { forceLoadFonts } from './util/fonts';
import { logSelfXssWarnings } from './util/logs';
import { initMultitab } from './util/multitab';
import {
  IS_DELEGATED_BOTTOM_SHEET, IS_DELEGATING_BOTTOM_SHEET, IS_ELECTRON, IS_IOS_APP,
} from './util/windowEnvironment';

import App from './components/App';

import './styles/index.scss';

if (DEBUG) {
  // eslint-disable-next-line no-console
  console.log('>>> INIT');
}

if (STRICTERDOM_ENABLED) {
  enableStrict();
}

if (IS_CAPACITOR) {
  void initCapacitor();
}

if (IS_ELECTRON) {
  void initElectron();
}

if (IS_DELEGATING_BOTTOM_SHEET) {
  initMultitab({ noPubGlobal: true });
} else if (IS_DELEGATED_BOTTOM_SHEET) {
  initMultitab();
}

(async () => {
  if (IS_IOS_APP) {
    await fixIosAppStorage();
  }

  await window.electron?.restoreStorage();

  getActions().init();
  getActions().initApi();

  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.log('>>> START INITIAL RENDER');
  }

  requestMutation(() => {
    TeactDOM.render(
      <App />,
      document.getElementById('root')!,
    );

    forceLoadFonts();
    betterView();
  });

  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.log('>>> FINISH INITIAL RENDER');
  }

  document.addEventListener('dblclick', () => {
    // eslint-disable-next-line no-console
    console.warn('GLOBAL STATE', getGlobal());
  });

  if (window.top === window) {
    logSelfXssWarnings();
  }
})();
