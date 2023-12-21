import type { NftItem } from 'tonapi-sdk-js';

import type { ApiNft, ApiNftUpdate } from '../../types';

import { parseAccountId } from '../../../util/account';
import { compact } from '../../../util/iteratees';
import { fetchAccountEvents, fetchAccountNfts, fetchNftItems } from './util/tonapiio';
import { toBase64Address } from './util/tonweb';
import { fetchStoredAddress } from '../../common/accounts';
import { isActiveSmartContract } from './wallet';

export async function getAccountNfts(accountId: string, offset?: number, limit?: number): Promise<ApiNft[]> {
  const { network } = parseAccountId(accountId);
  const address = await fetchStoredAddress(accountId);

  const rawNfts = await fetchAccountNfts(network, address, { offset, limit });
  return compact(rawNfts.map(buildNft));
}

export function buildNft(rawNft: NftItem): ApiNft | undefined {
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
        attributes,
        description,
      },
      previews,
      sale,
    } = rawNft;

    const isHidden = attributes?.render_type === 'hidden' || description === 'SCAM';

    return {
      index,
      name,
      address: toBase64Address(address, true),
      image,
      thumbnail: previews!.find((x) => x.resolution === '500x500')!.url,
      isOnSale: Boolean(sale),
      isHidden,
      ...(collection && {
        collectionAddress: toBase64Address(collection.address, true),
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
      const isPurchase = !!action.nftPurchase;

      if (action.nftItemTransfer) {
        const { sender, recipient, nft: rawNftAddress } = action.nftItemTransfer;
        if (!sender || !recipient) continue;
        to = toBase64Address(recipient.address);
        nftAddress = toBase64Address(rawNftAddress, true);
      } else if (action.nftPurchase) {
        const { buyer } = action.nftPurchase;
        to = toBase64Address(buyer.address);
        rawNft = action.nftPurchase.nft;
        nftAddress = toBase64Address(rawNft.address, true);
      } else {
        continue;
      }

      if (to === address) {
        if (!rawNft) {
          [rawNft] = await fetchNftItems(network, [nftAddress]);
        }
        const nft = buildNft(rawNft);

        if (nft) {
          updates.push({
            type: 'nftReceived',
            accountId,
            nftAddress,
            nft,
          });
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
