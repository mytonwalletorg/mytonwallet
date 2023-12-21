import type { ApiDbNft } from '../db';
import type { ApiNft, ApiUpdate, OnApiUpdate } from '../types';

import blockchains from '../blockchains';
import { resolveBlockchainKey } from '../common/helpers';
import { apiDb } from '../db';

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

export async function updateNfts(accountId: string, nfts: ApiNft[]) {
  const visibleNfts = nfts.filter((nft) => !nft.isHidden);
  onUpdate({
    type: 'updateNfts',
    accountId,
    nfts: visibleNfts,
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
