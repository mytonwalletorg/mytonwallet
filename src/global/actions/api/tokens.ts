import { TON_TOKEN_SLUG } from '../../../config';
import { callApi } from '../../../api';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import { updateTokenPriceHistory } from '../../reducers/tokens';

addActionHandler('loadPriceHistory', async (global, actions, payload) => {
  const { slug, period, currency = global.settings.baseCurrency } = payload ?? {};

  // The `ALL` range is only available for TON
  if (slug !== TON_TOKEN_SLUG && period === 'ALL') return;

  const history = await callApi('fetchPriceHistory', slug, period, currency);

  if (!history) {
    return;
  }

  global = getGlobal();
  global = updateTokenPriceHistory(global, slug, { [period]: history });
  setGlobal(global);
});
