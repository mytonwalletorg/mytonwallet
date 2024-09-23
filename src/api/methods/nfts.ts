import type { ApiNft } from '../types';

import { TONCOIN } from '../../config';
import chains from '../chains';
import { fetchStoredTonWallet } from '../common/accounts';
import { createLocalTransaction } from './transactions';

const { ton } = chains;

export function fetchNfts(accountId: string) {
  return ton.getAccountNfts(accountId);
}

export function checkNftTransferDraft(options: {
  accountId: string;
  nftAddresses: string[];
  toAddress: string;
  comment?: string;
}) {
  return ton.checkNftTransferDraft(options);
}

export async function submitNftTransfers(
  accountId: string,
  password: string,
  nftAddresses: string[],
  toAddress: string,
  comment?: string,
  nfts?: ApiNft[],
  fee = 0n,
) {
  const { address: fromAddress } = await fetchStoredTonWallet(accountId);

  const result = await ton.submitNftTransfers({
    accountId, password, nftAddresses, toAddress, comment, nfts,
  });

  if ('error' in result) {
    return result;
  }

  for (const [i, message] of result.messages.entries()) {
    createLocalTransaction(accountId, 'ton', {
      amount: message.amount,
      fromAddress,
      toAddress,
      comment,
      fee,
      normalizedAddress: message.toAddress,
      slug: TONCOIN.slug,
      inMsgHash: result.msgHash,
      type: 'nftTransferred',
      nft: nfts?.[i],
    });
  }

  return result;
}
