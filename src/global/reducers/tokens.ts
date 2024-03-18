import type { GlobalState, PriceHistoryPeriods } from '../types';

export function updateTokenPriceHistory(global: GlobalState, slug: string, partial: PriceHistoryPeriods): GlobalState {
  const { bySlug } = global.tokenPriceHistory;

  return {
    ...global,
    tokenPriceHistory: {
      bySlug: {
        ...bySlug,
        [slug]: {
          ...bySlug[slug],
          ...partial,
        },
      },
    },
  };
}
