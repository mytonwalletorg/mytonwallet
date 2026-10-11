import type { ApiChain } from '../api/types';

import bnbBlockchainIcon from '../assets/blockchain/chain_bnb.svg';
import tonBlockchainIcon from '../assets/blockchain/chain_ton.svg';

const CHAIN_ICON_MAP: Record<ApiChain, string> = {
  ton: tonBlockchainIcon,
  bnb: bnbBlockchainIcon,
};

export default function getChainNetworkIcon(chain?: ApiChain) {
  if (!chain) return '';

  return CHAIN_ICON_MAP[chain];
}
