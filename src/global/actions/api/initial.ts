import { addActionHandler, getGlobal } from '../../index';
import { initApi } from '../../../api';
import { getIsTxIdLocal } from '../../helpers';

addActionHandler('initApi', (global, actions) => {
  void initApi(actions.apiUpdate, () => ({
    newestTxId: getGlobal().transactions?.orderedTxIds?.find((id) => !getIsTxIdLocal(id)),
  }));
});
