import type { ApiDbNft } from '../db';
import type { ApiNft, ApiUpdate, OnApiUpdate } from '../types';

import { TONCOIN_SLUG } from '../../config';
import blockchains from '../blockchains';
import { fetchStoredAddress } from '../common/accounts';
import { resolveBlockchainKey } from '../common/helpers';
import { apiDb } from '../db';
import { createLocalTransaction } from './transactions';

let onUpdate: OnApiUpdate;

export function initNfts(_onUpdate: OnApiUpdate) {
  onUpdate = _onUpdate;
}

export function fetchNfts(accountId: string) {
  const blockchain = blockchains[resolveBlockchainKey(accountId)!];

  return blockchain.getAccountNfts(accountId);
}

export async function processNftUpdates(accountId: string, updates: ApiUpdate[]) {
  updates.filter((update) => !(update.type === 'nftReceived' && update.nft.isHidden)).forEach(onUpdate);

  for (const update of updates) {
    if (update.type === 'nftSent') {
      const key = [accountId, update.nftAddress];
      await apiDb.nfts.delete(key);
    } else if (update.type === 'nftReceived') {
      const dbNft = convertToDbEntity(accountId, update.nft);
      await apiDb.nfts.put(dbNft);
    } else if (update.type === 'nftPutUpForSale') {
      const key = [accountId, update.nftAddress];
      await apiDb.nfts.update(key, { isOnSale: true });
    }
  }
}

export async function updateAccountNfts(accountId: string, nfts: ApiNft[]) {
  onUpdate({
    type: 'updateNfts',
    accountId,
    nfts,
  });

  const dbNfts = nfts.map((nft) => convertToDbEntity(accountId, nft));

  await apiDb.nfts.where({ accountId }).delete();
  await apiDb.nfts.bulkPut(dbNfts);
}

function convertToDbEntity(accountId: string, nft: ApiNft): ApiDbNft {
  return {
    ...nft,
    collectionAddress: nft.collectionAddress ?? '',
    accountId,
  };
}

export function checkNftTransferDraft(options: {
  accountId: string;
  nftAddresses: string[];
  toAddress: string;
  comment?: string;
}) {
  const blockchain = blockchains[resolveBlockchainKey(options.accountId)!];

  return blockchain.checkNftTransferDraft(options);
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
  const blockchain = blockchains[resolveBlockchainKey(accountId)!];
  const fromAddress = await fetchStoredAddress(accountId);

  const result = await blockchain.submitNftTransfers({
    accountId, password, nftAddresses, toAddress, comment, nfts,
  });

  if ('error' in result) {
    return result;
  }

  for (const [i, message] of result.messages.entries()) {
    createLocalTransaction(accountId, {
      amount: message.amount,
      fromAddress,
      toAddress: message.toAddress,
      comment,
      fee,
      slug: TONCOIN_SLUG,
      inMsgHash: result.msgHash,
      type: 'nftTransferred',
      nft: nfts?.[i],
    });
  }

  return result;
}
