import type { ApiNft } from '../types';

import { TONCOIN } from '../../config';
import { buildCollectionByKey, extractKey } from '../../util/iteratees';
import chains from '../chains';
import { fetchStoredTonWallet } from '../common/accounts';
import { createLocalTransactions } from './transactions';

const { ton } = chains;

export function checkDnsRenewalDraft(accountId: string, nfts: ApiNft[]) {
  const nftAddresses = extractKey(nfts, 'address');
  return ton.checkDnsRenewalDraft(accountId, nftAddresses);
}

export async function submitDnsRenewal(accountId: string, password: string, nfts: ApiNft[], realFee = 0n) {
  const { address: fromAddress } = await fetchStoredTonWallet(accountId);

  const nftByAddress = buildCollectionByKey(nfts, 'address');
  const results: ({ activityIds: string[] } | { error: string })[] = [];

  for await (const { addresses, result } of ton.submitDnsRenewal(accountId, password, Object.keys(nftByAddress))) {
    if ('error' in result) {
      results.push(result);
      continue;
    }

    const localActivities = createLocalTransactions(accountId, 'ton', addresses.map((address) => {
      const nft = nftByAddress[address];
      return {
        txId: result.msgHashNormalized,
        amount: 0n,
        fromAddress,
        toAddress: nft.address,
        fee: realFee / BigInt(nfts.length),
        normalizedAddress: nft.address,
        slug: TONCOIN.slug,
        externalMsgHashNorm: result.msgHashNormalized,
        nft,
        type: 'dnsRenew',
      };
    }));

    results.push({
      activityIds: extractKey(localActivities, 'id'),
    });
  }

  return results;
}

export function checkDnsChangeWalletDraft(accountId: string, nft: ApiNft, address: string) {
  return ton.checkDnsChangeWalletDraft(accountId, nft.address, address);
}

export async function submitDnsChangeWallet(
  accountId: string,
  password: string,
  nft: ApiNft,
  address: string,
  realFee = 0n,
) {
  const { address: walletAddress } = await fetchStoredTonWallet(accountId);
  const result = await ton.submitDnsChangeWallet(accountId, password, nft.address, address);

  if ('error' in result) {
    return result;
  }

  const [activity] = createLocalTransactions(accountId, 'ton', [{
    txId: result.msgHashNormalized,
    amount: 0n,
    fromAddress: walletAddress,
    toAddress: nft.address,
    fee: realFee,
    normalizedAddress: nft.address,
    slug: TONCOIN.slug,
    externalMsgHashNorm: result.msgHashNormalized,
    nft,
    type: 'dnsChangeAddress',
  }]);

  return { activityId: activity.id };
}
