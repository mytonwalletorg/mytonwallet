import { callApi } from '../../../api';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import { updateActivity } from '../../reducers';
import { selectAccountState } from '../../selectors';

addActionHandler('fetchActivityDetails', async (global, actions, { id }) => {
  const accountId = global.currentAccountId!;
  const activity = selectAccountState(global, accountId)?.activities?.byId[id];

  if (!activity?.shouldLoadDetails) {
    return;
  }

  const newActivity = await callApi('fetchTonActivityDetails', accountId, activity);

  if (!newActivity) {
    return;
  }

  global = updateActivity(getGlobal(), accountId, newActivity);
  setGlobal(global);
});
