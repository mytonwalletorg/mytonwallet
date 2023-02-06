import { addActionHandler, getGlobal, setGlobal } from '../../index';

import { callApi } from '../../../api';
import { clearDappConnectRequestError, clearDappConnectRequest, updateDappConnectRequest } from '../../reducers';

addActionHandler('submitDappConnectRequestConfirm', async (global, actions, payload) => {
  const { password, additionalAccountIds } = payload;
  const { promiseId, permissions } = global.dappConnectRequest!;

  if (permissions?.isPasswordRequired && (!password || !(await callApi('verifyPassword', password)))) {
    global = getGlobal();
    setGlobal(updateDappConnectRequest(global, { error: 'Wrong password, please try again' }));

    return;
  }

  void callApi('confirmDappRequestConnect', promiseId!, password, additionalAccountIds);

  global = getGlobal();
  global = clearDappConnectRequest(global);
  setGlobal(global);
});

addActionHandler('clearDappConnectRequestError', (global) => {
  global = clearDappConnectRequestError(global);
  setGlobal(global);
});

addActionHandler('cancelDappConnectRequestConfirm', (global) => {
  const { promiseId } = global.dappConnectRequest || {};

  if (!promiseId) {
    return;
  }

  void callApi('cancelDappRequest', promiseId!, 'Canceled by the user');

  global = getGlobal();
  global = clearDappConnectRequest(global);
  setGlobal(global);
});
