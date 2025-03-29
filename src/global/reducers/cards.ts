import type { GlobalState } from '../types';

export function updateMintCards(
  global: GlobalState,
  update: Partial<GlobalState['currentMintCard']>,
): GlobalState {
  return {
    ...global,
    currentMintCard: {
      ...global.currentMintCard,
      ...update,
    },
  };
}
