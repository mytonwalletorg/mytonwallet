import type { ApiNft } from '../types';

import { TONCOIN } from '../../config';
import { bigintDivideToNumber } from '../../util/bigint';
import chains from '../chains';
import { fetchStoredTonWallet } from '../common/accounts';
import { createLocalTransaction } from './transactions';

const { ton } = chains;

export function fetchNfts(accountId: string) {
  return ton.getAccountNfts(accountId);
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

  for (const [i, message] of result.messages.entries()) {
    createLocalTransaction(accountId, 'ton', {
      amount: message.amount,
      fromAddress,
      toAddress,
      comment,
      fee: realFeePerNft,
      normalizedAddress: message.toAddress,
      slug: TONCOIN.slug,
      inMsgHash: result.msgHash,
      type: 'nftTransferred',
      nft: nfts?.[i],
    });
  }

  return result;
}

export function checkNftOwnership(accountId: string, nftAddress: string) {
  return ton.checkNftOwnership(accountId, nftAddress);
}
