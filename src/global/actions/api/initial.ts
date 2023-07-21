import { ElectronEvent } from '../../../electron/types';

import { tonConnectGetDeviceInfo } from '../../../util/tonConnectEnvironment';
import { IS_CHROME_EXTENSION } from '../../../util/windowEnvironment';
import { callApi, initApi } from '../../../api';
import { addActionHandler, getGlobal } from '../../index';
import { selectNewestTxIds } from '../../selectors';

addActionHandler('initApi', async (global, actions) => {
  const origin = IS_CHROME_EXTENSION ? `chrome-extension://${chrome.runtime.id}` : window.location.origin;
  initApi(actions.apiUpdate, { origin });

  window.electron?.on(ElectronEvent.DEEPLINK_TONCONNECT, (params: { url: string }) => {
    const deviceInfo = tonConnectGetDeviceInfo();
    void callApi('startSseConnection', params.url, deviceInfo);
  });

  await callApi('waitDataPreload');

  const { currentAccountId } = getGlobal();

  if (!currentAccountId) {
    return;
  }

  void callApi(
    'activateAccount',
    currentAccountId,
    selectNewestTxIds(global, currentAccountId),
  );
});
