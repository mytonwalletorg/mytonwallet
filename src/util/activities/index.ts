import type { ApiActivity, ApiTransaction, ApiTransactionType } from '../../api/types';
import type { LangFn } from '../langProvider';

import { compareActivities } from '../compareActivities';
import { unique } from '../iteratees';
import { getIsTransactionWithPoisoning } from '../poisoningHash';

type UnusualTxType = 'backend-swap' | 'local' | 'additional';

const TRANSACTION_TYPE_TITLES: { [K in ApiTransactionType & keyof any]?: [complete: string, inProgress: string] } = {
  stake: ['Staked', 'Staking'],
  unstake: ['Unstaked', 'Unstaking'],
  unstakeRequest: ['Unstake Requested', 'Requesting Unstake'],
  callContract: ['Contract Called', 'Calling Contract'],
  excess: ['Excess', 'Excess'],
  contractDeploy: ['Contract Deployed', 'Deploying Contract'],
  bounced: ['Bounced', 'Bouncing'],
  mint: ['Minted', 'Minting'],
  burn: ['Burned', 'Burning'],
  auctionBid: ['NFT Auction Bid', 'Bidding at NFT Auction'],
  dnsChangeAddress: ['Address Updated', 'Updating Address'],
  dnsChangeSite: ['Site Updated', 'Updating Site'],
  dnsChangeSubdomains: ['Subdomains Updated', 'Updating Subdomains'],
  dnsChangeStorage: ['Storage Updated', 'Updating Storage'],
  dnsDelete: ['Domain Record Deleted', 'Deleting Domain Record'],
  dnsRenew: ['Domain Renewed', 'Renewing Domain'],
  liquidityDeposit: ['Liquidity Provided', 'Providing Liquidity'],
  liquidityWithdraw: ['Liquidity Withdrawn', 'Withdrawing Liquidity'],
};

export const STAKING_TRANSACTION_TYPES = new Set<ApiTransactionType | undefined>([
  'stake', 'unstake', 'unstakeRequest',
]);

export const DNS_TRANSACTION_TYPES = new Set<ApiTransactionType | undefined>([
  'dnsChangeAddress', 'dnsChangeSite', 'dnsChangeStorage', 'dnsChangeSubdomains', 'dnsDelete', 'dnsRenew',
]);

export function parseTxId(txId: string): {
  hash: string;
  subId?: string;
  type?: UnusualTxType;
} {
  const [hash, subId, type] = txId.split(':') as [string, string | undefined, UnusualTxType | undefined];
  return { hash, type, subId };
}

export function getIsTxIdLocal(txId: string) {
  return txId.endsWith(':local');
}

export function getIsBackendSwapId(id: string) {
  return id.endsWith(':backend-swap');
}

export function buildBackendSwapId(backendId: string) {
  return buildTxId(backendId, undefined, 'backend-swap');
}

export function buildLocalTxId(hash: string, subId?: number) {
  return buildTxId(hash, subId, 'local');
}

export function buildTxId(hash: string, subId?: number | string, type?: UnusualTxType) {
  if (!type && subId === undefined) return hash;
  if (type === undefined) return `${hash}:${subId}`;
  return `${hash}:${subId ?? ''}:${type}`;
}

// eslint-disable-next-line consistent-return
export function getActivityTokenSlugs(activity: ApiActivity): string[] {
  switch (activity.kind) {
    case 'transaction': {
      if (activity.nft) return []; // We don't want NFT activities to get into any token activity list
      return [activity.slug];
    }
    case 'swap': {
      return [activity.from, activity.to];
    }
  }
}

export function getIsIdSuitableForFetchingTimestamp(id: string) {
  return !getIsTxIdLocal(id) && !getIsBackendSwapId(id);
}

export function getTransactionTitle(
  { type, isIncoming }: ApiTransaction,
  isInProgress: boolean,
  translate: LangFn,
) {
  if (type) {
    const titles = TRANSACTION_TYPE_TITLES[type];
    if (titles) {
      return translate(titles[isInProgress ? 1 : 0]);
    }
  }
  if (isIncoming) {
    return translate(isInProgress ? 'Receiving' : 'Received');
  }
  return translate(isInProgress ? 'Sending' : 'Sent');
}

export function isScamTransaction(transaction: ApiTransaction) {
  return Boolean(transaction.metadata?.isScam)
    || (transaction.isIncoming && getIsTransactionWithPoisoning(transaction));
}

export function shouldShowTransactionComment(transaction: ApiTransaction) {
  return Boolean(transaction.comment || transaction.encryptedComment)
    && !STAKING_TRANSACTION_TYPES.has(transaction.type)
    && !isScamTransaction(transaction);
}

export function getTransactionAmountDisplayMode({ type, amount, nft }: ApiTransaction) {
  const isPlainTransfer = type === undefined && !nft;
  if (!amount && !isPlainTransfer) {
    return 'hide';
  }
  return type === 'stake' || type === 'unstake'
    ? 'noSign'
    : 'normal';
}

export function shouldShowTransactionAddress({ type, isIncoming, nft, toAddress }: ApiTransaction) {
  const shouldHide = STAKING_TRANSACTION_TYPES.has(type) || type === 'burn'
    || (!isIncoming && nft && toAddress === nft.address);

  return !shouldHide;
}

export function mergeActivitiesToMaxTime(array1: ApiActivity[], array2: ApiActivity[]) {
  if (!array1.length && !array2.length) {
    return [];
  } else if (!array1.length && array2.length) {
    return array2;
  } else if (!array2.length && array1.length) {
    return array1;
  }

  const fromTimestamp = Math.max(
    array1[array1.length - 1].timestamp,
    array2[array2.length - 1].timestamp,
  );

  return [...array1, ...array2]
    .filter(({ timestamp }) => timestamp >= fromTimestamp)
    .sort(compareActivities);
}

export function mergeActivityIdsToMaxTime(array1: string[], array2: string[], byId: Record<string, ApiActivity>) {
  if (!array1.length && !array2.length) {
    return [];
  } else if (!array1.length && array2.length) {
    return array2;
  } else if (!array2.length && array1.length) {
    return array1;
  }

  const fromTimestamp = Math.max(
    byId[array1[array1.length - 1]].timestamp,
    byId[array2[array2.length - 1]].timestamp,
  );

  return unique([...array1, ...array2])
    .filter((id) => byId[id].timestamp >= fromTimestamp)
    .sort((a, b) => compareActivities(byId[a], byId[b]));
}
