import { addActionHandler, setGlobal } from '../../index';
import {
  addToSelectedAddresses,
  removeFromSelectedAddresses,
  updateAccountState,
  updateCurrentAccountState,
} from '../../reducers';
import { selectAccountState, selectCurrentAccountState } from '../../selectors';

addActionHandler('openNftCollection', (global, actions, { address }) => {
  const accountId = global.currentAccountId!;
  const accountState = selectAccountState(global, accountId);
  global = updateAccountState(global, accountId, {
    nfts: {
      ...accountState!.nfts!,
      currentCollectionAddress: address,
    },
  });
  return global;
});

addActionHandler('closeNftCollection', (global) => {
  const accountState = selectCurrentAccountState(global);
  global = updateCurrentAccountState(global, {
    nfts: {
      ...accountState!.nfts!,
      currentCollectionAddress: undefined,
    },
    selectedNftsToHide: undefined,
  });
  return global;
});

addActionHandler('selectNfts', (global, actions, { addresses }) => {
  const accountId = global.currentAccountId!;
  global = addToSelectedAddresses(global, accountId, addresses);
  setGlobal(global);
});

addActionHandler('clearNftSelection', (global, actions, { address }) => {
  const accountId = global.currentAccountId!;
  global = removeFromSelectedAddresses(global, accountId, address);
  setGlobal(global);
});

addActionHandler('clearNftsSelection', (global) => {
  const accountId = global.currentAccountId!;
  const accountState = selectAccountState(global, accountId);
  global = updateAccountState(global, accountId, {
    nfts: {
      ...accountState!.nfts!,
      selectedAddresses: [],
    },
  });
  setGlobal(global);
});
