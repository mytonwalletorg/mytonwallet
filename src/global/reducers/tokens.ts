import type { ApiToken } from '../../api/types';
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

export function updateTokenInfo(global: GlobalState, partial: Record<string, ApiToken>): GlobalState {
  return {
    ...global,
    tokenInfo: {
      ...global.tokenInfo,
      bySlug: {
        ...global.tokenInfo.bySlug,
        ...partial,
      },
    },
  };
}
