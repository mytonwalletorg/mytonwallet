import type { ApiNft } from '../types';

import { TONCOIN } from '../../config';
import { bigintDivideToNumber } from '../../util/bigint';
import chains from '../chains';
import { fetchStoredAccount, fetchStoredTonWallet } from '../common/accounts';
import { createLocalTransactions } from './transactions';

const { ton } = chains;

export async function fetchNfts(accountId: string) {
  const account = await fetchStoredAccount(accountId);
  return 'ton' in account ? ton.getAccountNfts(accountId) : [];
}

export function checkNftTransferDraft(options: {
  accountId: string;
  nfts: ApiNft[];
  toAddress: string;
  comment?: string;
}) {
  return ton.checkNftTransferDraft(options);
}

export async function submitNftTransfers(
  accountId: string,
  password: string,
  nfts: ApiNft[],
  toAddress: string,
  comment?: string,
  totalRealFee = 0n,
) {
  const { address: fromAddress } = await fetchStoredTonWallet(accountId);

  const result = await ton.submitNftTransfers({
    accountId, password, nfts, toAddress, comment,
  });

  if ('error' in result) {
    return result;
  }

  const realFeePerNft = bigintDivideToNumber(totalRealFee, Object.keys(result.messages).length);

  createLocalTransactions(accountId, 'ton', result.messages.map((message, index) => ({
    txId: result.msgHashNormalized,
    amount: 0n, // Regular NFT transfers should have no amount in the activity list
    fromAddress,
    toAddress,
    comment,
    fee: realFeePerNft,
    normalizedAddress: message.toAddress,
    slug: TONCOIN.slug,
    externalMsgHashNorm: result.msgHashNormalized,
    nft: nfts?.[index],
  })));

  return result;
}

export async function checkNftOwnership(accountId: string, nftAddress: string) {
  const account = await fetchStoredAccount(accountId);
  return 'ton' in account && ton.checkNftOwnership(accountId, nftAddress);
}
