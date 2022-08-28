import { addActionHandler } from '../../index';
import { initApi } from '../../../api';

addActionHandler('initApi', (global, actions) => {
  void initApi(actions.apiUpdate);
});
