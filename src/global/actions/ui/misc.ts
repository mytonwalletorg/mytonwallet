import { addActionHandler } from '../../index';

addActionHandler('showTransactionInfo', (global, actions, { txId }) => {
  return {
    ...global,
    currentTransactionId: txId,
  };
});

addActionHandler('closeTransactionInfo', (global) => {
  return {
    ...global,
    currentTransactionId: undefined,
  };
});

addActionHandler('addSavedAddress', (global, actions, { address, name }) => {
  return {
    ...global,
    savedAddresses: {
      ...global.savedAddresses,
      [address]: name,
    },
  };
});

addActionHandler('removeFromSavedAddress', (global, actions, { address }) => {
  const { [address]: omit, ...savedAddresses } = global.savedAddresses || {};

  return {
    ...global,
    savedAddresses,
  };
});

addActionHandler('toggleTinyTransfersHidden', (global, actions, { isEnabled }) => {
  return {
    ...global,
    settings: {
      ...global.settings,
      areTinyTransfersHidden: isEnabled,
    },
  };
});
