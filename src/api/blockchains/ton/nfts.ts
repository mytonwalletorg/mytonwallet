import type { NftItem } from 'tonapi-sdk-js';
import type { Cell } from '@ton/core';
import { Address, Builder } from '@ton/core';

import type { ApiNft, ApiNftUpdate } from '../../types';

import { TON_TOKEN_SLUG } from '../../../config';
import { parseAccountId } from '../../../util/account';
import { compact } from '../../../util/iteratees';
import { generateQueryId } from './util';
import { buildNft } from './util/metadata';
import { fetchAccountEvents, fetchAccountNfts, fetchNftItems } from './util/tonapiio';
import { commentToBytes, packBytesAsSnake, toBase64Address } from './util/tonCore';
import { fetchStoredAddress } from '../../common/accounts';
import {
  NFT_TRANSFER_TON_AMOUNT, NFT_TRANSFER_TON_FORWARD_AMOUNT, NftOpCode,
} from './constants';
import { checkToAddress, checkTransactionDraft, submitTransfer } from './transactions';
import { isActiveSmartContract } from './wallet';

export async function getAccountNfts(accountId: string, offset?: number, limit?: number): Promise<ApiNft[]> {
  const { network } = parseAccountId(accountId);
  const address = await fetchStoredAddress(accountId);

  const rawNfts = await fetchAccountNfts(network, address, { offset, limit });
  return compact(rawNfts.map((rawNft) => buildNft(network, rawNft)));
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

export async function checkNftTransferDraft(
  accountId: string,
  nftAddress: string,
  toAddress: string,
  comment?: string,
) {
  const { network } = parseAccountId(accountId);
  const address = await fetchStoredAddress(accountId);

  const checkAddressResult = await checkToAddress(network, toAddress);

  if ('error' in checkAddressResult) {
    return checkAddressResult;
  }

  toAddress = checkAddressResult.resolvedAddress!;
  const payload = buildNftTransferPayload(address, toAddress, comment);

  const result = await checkTransactionDraft({
    accountId,
    slug: TON_TOKEN_SLUG,
    toAddress: nftAddress,
    amount: NFT_TRANSFER_TON_AMOUNT,
    data: payload,
    shouldSkipHardwareChecking: true,
  });

  if ('error' in result) {
    return result;
  }

  return {
    ...result,
    ...checkAddressResult,
  } as {
    fee: bigint;
    resolvedAddress: string;
    addressName?: string;
    isScam?: boolean;
    isToAddressNew?: boolean;
  };
}

export async function submitNftTransfer(
  accountId: string,
  password: string,
  nftAddress: string,
  toAddress: string,
  comment?: string,
) {
  const fromAddress = await fetchStoredAddress(accountId);
  const payload = buildNftTransferPayload(fromAddress, toAddress, comment);

  const slug = TON_TOKEN_SLUG;
  const amount = NFT_TRANSFER_TON_AMOUNT;
  toAddress = nftAddress;

  const result = await submitTransfer(
    accountId, password, slug, toAddress, amount, payload,
  );

  return {
    ...result,
    amount,
    slug,
  };
}

function buildNftTransferPayload(fromAddress: string, toAddress: string, comment?: string) {
  const forwardAmount = NFT_TRANSFER_TON_FORWARD_AMOUNT;

  let builder = new Builder()
    .storeUint(NftOpCode.TransferOwnership, 32)
    .storeUint(generateQueryId(), 64)
    .storeAddress(Address.parse(toAddress))
    .storeAddress(Address.parse(fromAddress))
    .storeBit(false) // null custom_payload
    .storeCoins(forwardAmount);

  let forwardPayload: Cell | Uint8Array | undefined;

  if (comment) {
    const bytes = commentToBytes(comment);
    const freeBytes = Math.floor(builder.availableBits / 8);
    forwardPayload = packBytesAsSnake(bytes, freeBytes);
  }

  if (forwardPayload instanceof Uint8Array) {
    builder.storeBit(0);
    builder = builder.storeBuffer(Buffer.from(forwardPayload));
  } else {
    builder = builder.storeMaybeRef(forwardPayload);
  }

  return builder.endCell();
}
