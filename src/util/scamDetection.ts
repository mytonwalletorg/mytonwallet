import type { ApiChain } from '../api/types';
import type { Account, UserToken } from '../global/types';

import { TRC20_USDT_MAINNET_SLUG, TRX } from '../config';
import { HOUR } from './dateFormat';

export function shouldShowSeedPhraseScamWarning(
  account: Account,
  accountTokens: UserToken[],
  transferTokenChain: ApiChain,
): boolean {
  // Only check for recently imported accounts (within 1 hour)
  if (!account.importedAt || Date.now() - account.importedAt > HOUR) {
    return false;
  }

  // Only show when trying to transfer TRON tokens
  if (transferTokenChain !== 'tron') {
    return false;
  }

  // Check if account has TRON tokens (like USDT)
  const hasTronTokens = accountTokens.some((token) =>
    token.slug === TRC20_USDT_MAINNET_SLUG
    || (token.chain === 'tron' && token.amount > 0n && token.slug !== TRX.slug),
  );

  return hasTronTokens;
}
