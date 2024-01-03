import { addActionHandler } from '../../index';

addActionHandler('toggleSwapSettingsModal', (global, actions, { isOpen }) => {
  return {
    ...global,
    currentSwap: {
      ...global.currentSwap,
      isSettingsModalOpen: isOpen,
    },
  };
});
