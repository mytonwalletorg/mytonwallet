import type { ApiNft, ApiUpdate, OnApiUpdate } from '../types';

import { type ApiDbNft, nftRepository } from '../db';

export async function processNftUpdates(accountId: string, updates: ApiUpdate[], onUpdate: OnApiUpdate) {
  updates.filter((update) => !(update.type === 'nftReceived' && update.nft.isHidden)).forEach(onUpdate);

  for (const update of updates) {
    if (update.type === 'nftSent') {
      const key = [accountId, update.nftAddress];
      await nftRepository.delete(key);
    } else if (update.type === 'nftReceived') {
      const dbNft = convertToDbEntity(accountId, update.nft);
      await nftRepository.put(dbNft);
    } else if (update.type === 'nftPutUpForSale') {
      const key = [accountId, update.nftAddress];
      await nftRepository.update(key, { isOnSale: true });
    }
  }
}

export async function updateAccountNfts(accountId: string, nfts: ApiNft[], onUpdate: OnApiUpdate) {
  onUpdate({
    type: 'updateNfts',
    accountId,
    nfts,
  });

  const dbNfts = nfts.map((nft) => convertToDbEntity(accountId, nft));

  await nftRepository.deleteWhere({ accountId });
  await nftRepository.bulkPut(dbNfts);
}

function convertToDbEntity(accountId: string, nft: ApiNft): ApiDbNft {
  return {
    ...nft,
    collectionAddress: nft.collectionAddress ?? '',
    accountId,
  };
}
