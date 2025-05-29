import { DomainLinkingState, DomainRenewalState } from '../../types';

import { addActionHandler } from '../../index';
import { INITIAL_STATE } from '../../initialState';
import { updateCurrentDomainLinking, updateCurrentDomainRenewal } from '../../reducers';
import { selectIsHardwareAccount } from '../../selectors';

addActionHandler('openDomainRenewalModal', (global, actions, { addresses }) => {
  return updateCurrentDomainRenewal(global, {
    state: DomainRenewalState.Initial,
    addresses,
  });
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
