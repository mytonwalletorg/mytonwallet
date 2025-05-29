import type { ApiNft } from '../../api/types';
import type { GlobalState } from '../types';

import { isTonDnsNft } from '../../util/dns';
import { selectCurrentAccountState } from './accounts';

export function selectTonDnsLinkedAddress(global: GlobalState, nft: ApiNft | undefined) {
  const { linkedAddressByAddress } = selectCurrentAccountState(global)?.nfts || {};

  return isTonDnsNft(nft) ? linkedAddressByAddress?.[nft.address] : undefined;
}
