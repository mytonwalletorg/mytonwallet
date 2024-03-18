import type { NftItem } from 'tonapi-sdk-js';

import type { ApiNetwork, ApiNft, ApiNftUpdate } from '../../types';

import { parseAccountId } from '../../../util/account';
import { compact } from '../../../util/iteratees';
import { fetchAccountEvents, fetchAccountNfts, fetchNftItems } from './util/tonapiio';
import { toBase64Address } from './util/tonCore';
import { fetchStoredAddress } from '../../common/accounts';
import { isActiveSmartContract } from './wallet';

export async function getAccountNfts(accountId: string, offset?: number, limit?: number): Promise<ApiNft[]> {
  const { network } = parseAccountId(accountId);
  const address = await fetchStoredAddress(accountId);

  const rawNfts = await fetchAccountNfts(network, address, { offset, limit });
  return compact(rawNfts.map((rawNft) => buildNft(network, rawNft)));
}

export function buildNft(network: ApiNetwork, rawNft: NftItem): ApiNft | undefined {
  if (!rawNft.metadata) {
    return undefined;
  }

  try {
    const {
      address,
      index,
      collection,
      metadata: {
        name,
        image,
        description,
        render_type: renderType,
      },
      previews,
      sale,
    } = rawNft;

    const isHidden = renderType === 'hidden' || description === 'SCAM';

    return {
      index,
      name,
      address: toBase64Address(address, true, network),
      image,
      thumbnail: previews!.find((x) => x.resolution === '500x500')!.url,
      isOnSale: Boolean(sale),
      isHidden,
      ...(collection && {
        collectionAddress: toBase64Address(collection.address, true, network),
        collectionName: collection.name,
      }),
    };
  } catch (err) {
    return undefined;
  }
}

export async function getNftUpdates(accountId: string, fromSec: number) {
  const { network } = parseAccountId(accountId);
  const address = await fetchStoredAddress(accountId);

  const events = await fetchAccountEvents(network, address, fromSec);
  fromSec = events[0]?.timestamp ?? fromSec;
  events.reverse();
  const updates: ApiNftUpdate[] = [];

  for (const event of events) {
    for (const action of event.actions) {
      let to: string;
      let nftAddress: string;
      let rawNft: NftItem | undefined;
      const isPurchase = !!action.NftPurchase;

      if (action.NftItemTransfer) {
        const { sender, recipient, nft: rawNftAddress } = action.NftItemTransfer;
        if (!sender || !recipient) continue;
        to = toBase64Address(recipient.address, undefined, network);
        nftAddress = toBase64Address(rawNftAddress, true, network);
      } else if (action.NftPurchase) {
        const { buyer } = action.NftPurchase;
        to = toBase64Address(buyer.address, undefined, network);
        rawNft = action.NftPurchase.nft;
        if (!rawNft) {
          continue;
        }
        nftAddress = toBase64Address(rawNft.address, true, network);
      } else {
        continue;
      }

      if (to === address) {
        if (!rawNft) {
          [rawNft] = await fetchNftItems(network, [nftAddress]);
        }

        if (rawNft) {
          const nft = buildNft(network, rawNft);

          if (nft) {
            updates.push({
              type: 'nftReceived',
              accountId,
              nftAddress,
              nft,
            });
          }
        }
      } else if (!isPurchase && await isActiveSmartContract(network, to)) {
        updates.push({
          type: 'nftPutUpForSale',
          accountId,
          nftAddress,
        });
      } else {
        updates.push({
          type: 'nftSent',
          accountId,
          nftAddress,
        });
      }
    }
  }

  return [fromSec, updates] as [number, ApiNftUpdate[]];
}
