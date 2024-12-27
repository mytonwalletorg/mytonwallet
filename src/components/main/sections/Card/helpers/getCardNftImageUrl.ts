import type { ApiNft } from '../../../../../api/types';

import { MTW_CARDS_BASE_URL } from '../../../../../config';

export function getCardNftImageUrl(nft: ApiNft): string | undefined {
  return `${MTW_CARDS_BASE_URL}${nft.metadata!.mtwCardId}.webp`;
}
