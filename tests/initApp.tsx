import '../src/global/init';

import { getActions } from '../src/global';
import React from '../src/lib/teact/teact';
import TeactDOM from '../src/lib/teact/teact-dom';

import Main from '../src/components/main/Main';

const initApp = () => {
  return new Promise<void>(() => {
    const root = document.createElement('div');
    document.body.appendChild(root);

    getActions().init();
    getActions().initApi();

    TeactDOM.render(
      <Main />,
      root,
    );
  });
};

export default initApp;
