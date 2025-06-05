import { DomainLinkingState, DomainRenewalState } from '../../types';

import { waitFor } from '../../../util/schedulers';
import { closeAllOverlays } from '../../helpers/misc';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import { INITIAL_STATE } from '../../initialState';
import { updateCurrentDomainLinking, updateCurrentDomainRenewal } from '../../reducers';
import { selectCurrentAccountState, selectIsHardwareAccount } from '../../selectors';
import { switchAccount } from '../api/auth';

addActionHandler('openDomainRenewalModal', async (global, actions, { accountId, network, addresses }) => {
  if (accountId) {
    await Promise.all([
      closeAllOverlays(),
      switchAccount(global, accountId, network),
    ]);
  }
  // After switching account, wait for nft domains to be fetched
  if (!(await waitFor(() => Boolean(selectCurrentAccountState(getGlobal())?.nfts?.byAddress), 1000, 30))) {
    return;
  }

  global = getGlobal();

  const { byAddress } = selectCurrentAccountState(global)?.nfts || {};
  addresses = (addresses || []).filter((address) => byAddress?.[address]);
  if (!addresses.length) {
    return;
  }

  global = updateCurrentDomainRenewal(global, {
    state: DomainRenewalState.Initial,
    addresses,
  });
  setGlobal(global);
});

addActionHandler('startDomainsRenewal', (global) => {
  const isHardware = selectIsHardwareAccount(global);

  return updateCurrentDomainRenewal(global, {
    state: isHardware ? DomainRenewalState.ConnectHardware : DomainRenewalState.Password,
  });
});

addActionHandler('clearDomainsRenewalError', (global) => {
  return updateCurrentDomainRenewal(global, {
    error: undefined,
  });
});

addActionHandler('cancelDomainsRenewal', (global) => {
  return {
    ...global,
    currentDomainRenewal: INITIAL_STATE.currentDomainRenewal,
  };
});

addActionHandler('openDomainLinkingModal', (global, actions, { address }) => {
  return updateCurrentDomainLinking(global, {
    state: DomainLinkingState.Initial,
    address,
  });
});

addActionHandler('startDomainLinking', (global) => {
  const isHardware = selectIsHardwareAccount(global);

  return updateCurrentDomainLinking(global, {
    state: isHardware ? DomainLinkingState.ConnectHardware : DomainLinkingState.Password,
  });
});

addActionHandler('clearDomainLinkingError', (global) => {
  return updateCurrentDomainLinking(global, {
    error: undefined,
  });
});

addActionHandler('cancelDomainLinking', (global) => {
  return {
    ...global,
    currentDomainLinking: INITIAL_STATE.currentDomainLinking,
  };
});

addActionHandler('setDomainLinkingWalletAddress', (global, actions, { address }) => {
  return updateCurrentDomainLinking(global, { walletAddress: address });
});
