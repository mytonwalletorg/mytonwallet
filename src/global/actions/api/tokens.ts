import { callApi } from '../../../api';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import { updateTokenPriceHistory } from '../../reducers/tokens';

addActionHandler('loadPriceHistory', async (global, actions, payload) => {
  const { slug, period } = payload ?? {};

  const { baseCurrency } = global.settings;

  const history = await callApi('fetchPriceHistory', slug, period, baseCurrency);

  if (!history) {
    return;
  }

  global = getGlobal();
  global = updateTokenPriceHistory(global, slug, { [period]: history });
  setGlobal(global);
});
