import { addActionHandler, getGlobal } from '../../index';
import { callApi, initApi } from '../../../api';
import { getIsTxIdLocal } from '../../helpers';
import { selectCurrentAccountState } from '../../selectors';
import { IS_EXTENSION } from '../../../util/environment';

addActionHandler('initApi', (global, actions) => {
  initApi(actions.apiUpdate, {
    origin: IS_EXTENSION ? `chrome://${chrome.runtime.id}` : window.location.origin,
  });

  const { currentAccountId } = getGlobal();

  if (!currentAccountId) {
    return;
  }

  callApi(
    'activateAccount',
    currentAccountId,
    selectCurrentAccountState(global)?.transactions?.orderedTxIds?.find((id) => !getIsTxIdLocal(id)),
  );
});
