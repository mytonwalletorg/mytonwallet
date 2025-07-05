import type { ApiActivity, ApiTransaction, ApiTransactionActivity, ApiTransactionType } from '../../api/types';
import type { LangFn } from '../langProvider';

import { ALL_STAKING_POOLS, BURN_ADDRESS } from '../../config';
import { compareActivities } from '../compareActivities';
import { unique } from '../iteratees';
import { getIsTransactionWithPoisoning } from '../poisoningHash';

type UnusualTxType = 'backend-swap' | 'local' | 'additional';

type TranslationTenses = [past: string, present: string, future: string];

const TRANSACTION_TYPE_TITLES: Partial<Record<ApiTransactionType & keyof any, TranslationTenses>> = {
  stake: ['Staked', 'Staking', '$stake_action'],
  unstake: ['Unstaked', 'Unstaking', '$unstake_action'],
  unstakeRequest: ['Unstake Requested', 'Requesting Unstake', '$request_unstake_action'],
  callContract: ['Contract Called', 'Calling Contract', '$call_contract_action'],
  excess: ['Excess', 'Excess', 'Excess'],
  contractDeploy: ['Contract Deployed', 'Deploying Contract', '$deploy_contract_action'],
  bounced: ['Bounced', 'Bouncing', '$bounce_action'],
  mint: ['Minted', 'Minting', '$mint_action'],
  burn: ['Burned', 'Burning', '$burn_action'],
  auctionBid: ['NFT Auction Bid', 'Bidding at NFT Auction', 'NFT Auction Bid'],
  dnsChangeAddress: ['Address Updated', 'Updating Address', '$update_address_action'],
  dnsChangeSite: ['Site Updated', 'Updating Site', '$update_site_action'],
  dnsChangeSubdomains: ['Subdomains Updated', 'Updating Subdomains', '$update_subdomains_action'],
  dnsChangeStorage: ['Storage Updated', 'Updating Storage', '$update_storage_action'],
  dnsDelete: ['Domain Record Deleted', 'Deleting Domain Record', '$delete_domain_record_action'],
  dnsRenew: ['Domain Renewed', 'Renewing Domain', '$renew_domain_action'],
  liquidityDeposit: ['Liquidity Provided', 'Providing Liquidity', '$provide_liquidity_action'],
  liquidityWithdraw: ['Liquidity Withdrawn', 'Withdrawing Liquidity', '$withdraw_liquidity_action'],
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
  { type, isIncoming, nft }: ApiTransaction,
  tense: 'past' | 'present' | 'future',
  translate: LangFn,
) {
  const tenseIndex = tense === 'past' ? 0 : tense === 'present' ? 1 : 2;
  let titles: TranslationTenses;

  if (type === 'nftTrade') {
    titles = isIncoming
      ? ['NFT Sold', 'Selling NFT', '$sell_nft_action']
      : ['NFT Bought', 'Buying NFT', '$buy_nft_action'];
  } else if (type && TRANSACTION_TYPE_TITLES[type]) {
    titles = TRANSACTION_TYPE_TITLES[type];
  } else {
    titles = isIncoming
      ? ['Received', 'Receiving', '$receive_action']
      : ['Sent', 'Sending', '$send_action'];
  }

  let title = translate(titles[tenseIndex]);

  if (nft && (!type || type === 'mint' || type === 'burn')) {
    title += ' NFT';
  }

  return title;
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

/** Returns the UI sections where the address should be shown */
export function shouldShowTransactionAddress(transaction: ApiTransactionActivity): ('list' | 'modal')[] {
  const { type, isIncoming, nft, toAddress, fromAddress, extra } = transaction;

  if (type === 'nftTrade') {
    return extra?.marketplace ? ['list'] : [];
  }

  const shouldHide = isOurStakingTransaction(transaction)
    || type === 'burn'
    || (!isIncoming && nft && toAddress === nft.address)
    || (isIncoming && type === 'excess' && fromAddress === BURN_ADDRESS);

  return shouldHide ? [] : ['list', 'modal'];
}

/** "Our" is staking that can be controlled with MyTonWallet app */
export function isOurStakingTransaction({ type, isIncoming, toAddress, fromAddress }: ApiTransaction) {
  return STAKING_TRANSACTION_TYPES.has(type) && ALL_STAKING_POOLS.includes(isIncoming ? fromAddress : toAddress);
}

export function shouldShowTransactionAnnualYield(transaction: ApiTransaction) {
  return transaction.type === 'stake' && isOurStakingTransaction(transaction);
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

export function getIsActivityWithHash(activity: ApiTransactionActivity) {
  return !getIsTxIdLocal(activity.id) || !activity.extra?.withW5Gasless;
}
