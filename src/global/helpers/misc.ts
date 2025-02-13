import type { ApiChain } from '../../api/types';
import type { GlobalState } from '../types';

import { isValidAddressOrDomain } from '../../util/isValidAddressOrDomain';
import { getChainBySlug, getNativeToken } from '../../util/tokens';
import { getActions } from '../index';
import { selectCurrentAccount } from '../selectors';

import { getInAppBrowser } from '../../components/ui/InAppBrowser';

/**
 * Parses the transfer parameters from the given QR content, assuming it's a plain address.
 * Returns `undefined` if this is not a valid address or the account doesn't have the corresponding wallet.
 */
export function parsePlainAddressQr(global: GlobalState, qrData: string) {
  const availableChains = selectCurrentAccount(global)?.addressByChain ?? ({} as Record<ApiChain, string>);
  const newChain = getChainFromAddress(qrData, availableChains);
  if (!newChain) {
    return undefined;
  }

  const currentTokenSlug = global.currentTransfer.tokenSlug;
  const currentChain = getChainBySlug(currentTokenSlug);
  const newTokenSlug = newChain !== currentChain ? getNativeToken(newChain).slug : currentTokenSlug;

  return {
    toAddress: qrData,
    tokenSlug: newTokenSlug,
  };
}

function getChainFromAddress(address: string, availableChains: Record<ApiChain, unknown>): ApiChain | undefined {
  for (const chain of Object.keys(availableChains) as Array<keyof typeof availableChains>) {
    if (isValidAddressOrDomain(address, chain)) {
      return chain;
    }
  }

  return undefined;
}

export async function closeAllOverlays() {
  getActions().closeAnyModal();
  getActions().closeMediaViewer();
  await getInAppBrowser()?.close();
}
