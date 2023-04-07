import { addActionHandler, getGlobal } from '../../index';
import { callApi, initApi } from '../../../api';
import { selectNewestTxIds } from '../../selectors';
import { IS_EXTENSION } from '../../../util/windowEnvironment';

addActionHandler('initApi', async (global, actions) => {
  initApi(actions.apiUpdate, {
    origin: IS_EXTENSION ? `chrome-extension://${chrome.runtime.id}` : window.location.origin,
  });

  await callApi('waitDataPreload');

  const { currentAccountId } = getGlobal();

  if (!currentAccountId) {
    return;
  }

  callApi(
    'activateAccount',
    currentAccountId,
    selectNewestTxIds(global, currentAccountId),
  );
});
