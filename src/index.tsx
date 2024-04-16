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
    const selfXssWarnings: AnyLiteral = {
      en: 'WARNING! This console can be a way for bad people to take over your crypto wallet through something called '
        + 'a Self-XSS attack. So, don\'t put in or paste code you don\'t understand. Stay safe!',
      ru: 'ВНИМАНИЕ! Через эту консоль злоумышленники могут захватить ваш криптовалютный кошелёк с помощью так '
        + 'называемой атаки Self-XSS. Поэтому не вводите и не вставляйте код, который вы не понимаете. Берегите себя!',
      es: '¡ADVERTENCIA! Esta consola puede ser una forma en que las personas malintencionadas se apoderen de su '
        + 'billetera de criptomonedas mediante un ataque llamado Self-XSS. Por lo tanto, '
        + 'no introduzca ni pegue código que no comprenda. ¡Cuídese!',
      zh: '警告！这个控制台可能成为坏人通过所谓的Self-XSS攻击来接管你的加密货币钱包的方式。因此，请不要输入或粘贴您不理解的代码。请保护自己！',
    };

    const langCode = navigator.language.split('-')[0];
    const text = selfXssWarnings[langCode] || selfXssWarnings.en;

    // eslint-disable-next-line no-console
    console.log('%c%s', 'color: red; background: yellow; font-size: 18px;', text);
  }
})();
