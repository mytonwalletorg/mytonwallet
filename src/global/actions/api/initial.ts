import { DEFAULT_PRICE_CURRENCY, IS_EXTENSION } from '../../../config';
import { IS_DELEGATED_BOTTOM_SHEET, IS_ELECTRON } from '../../../util/windowEnvironment';
import { callApi, initApi } from '../../../api';
import { addActionHandler, getGlobal } from '../../index';
import { selectNewestTxIds } from '../../selectors';

addActionHandler('initApi', async (global, actions) => {
  initApi(actions.apiUpdate, {
    isElectron: IS_ELECTRON,
    isNativeBottomSheet: IS_DELEGATED_BOTTOM_SHEET,
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

addActionHandler('resetApiSettings', (global, actions, params) => {
  const isDefaultEnabled = !params?.areAllDisabled;

  if (IS_EXTENSION) {
    actions.toggleTonMagic({ isEnabled: false });
    actions.toggleTonProxy({ isEnabled: false });
  }
  if (IS_EXTENSION || IS_ELECTRON) {
    actions.toggleDeeplinkHook({ isEnabled: isDefaultEnabled });
  }
  actions.changeBaseCurrency({ currency: DEFAULT_PRICE_CURRENCY });
});
