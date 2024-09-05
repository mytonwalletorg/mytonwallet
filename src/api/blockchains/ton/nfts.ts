import type { NftItem } from 'tonapi-sdk-js';
import type { Cell } from '@ton/core';
import { Address, Builder } from '@ton/core';

import type { ApiNft, ApiNftUpdate } from '../../types';
import type { ApiCheckTransactionDraftResult } from './types';

import {
  BURN_ADDRESS,
  NFT_BATCH_SIZE,
  NOTCOIN_EXCHANGERS,
  NOTCOIN_FORWARD_TON_AMOUNT,
  NOTCOIN_VOUCHERS_ADDRESS,
} from '../../../config';
import { parseAccountId } from '../../../util/account';
import { compact } from '../../../util/iteratees';
import { generateQueryId } from './util';
import { buildNft } from './util/metadata';
import { fetchAccountEvents, fetchAccountNfts, fetchNftItems } from './util/tonapiio';
import { commentToBytes, packBytesAsSnake, toBase64Address } from './util/tonCore';
import { fetchStoredAccount, fetchStoredAddress } from '../../common/accounts';
import { NFT_TRANSFER_AMOUNT, NFT_TRANSFER_FORWARD_AMOUNT, NftOpCode } from './constants';
import { checkMultiTransactionDraft, checkToAddress, submitMultiTransfer } from './transactions';
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

export async function checkNftTransferDraft(options: {
  accountId: string;
  nftAddresses: string[];
  toAddress: string;
  comment?: string;
}): Promise<ApiCheckTransactionDraftResult> {
  const { accountId, nftAddresses, comment } = options;
  let { toAddress } = options;

  const { network } = parseAccountId(accountId);
  const { address: fromAddress } = await fetchStoredAccount(accountId);

  const checkAddressResult = await checkToAddress(network, toAddress);

  if ('error' in checkAddressResult) {
    return checkAddressResult;
  }

  toAddress = checkAddressResult.resolvedAddress!;

  // We only need to check the first batch of a multi-transaction
  const messages = nftAddresses.slice(0, NFT_BATCH_SIZE).map((nftAddress) => {
    return {
      payload: buildNftTransferPayload(fromAddress, toAddress, comment),
      amount: NFT_TRANSFER_AMOUNT,
      toAddress: nftAddress,
    };
  });

  const result = await checkMultiTransactionDraft(accountId, messages);

  if ('error' in result) {
    return result;
  }

  return {
    ...result,
    ...checkAddressResult,
  };
}

export async function submitNftTransfers(options: {
  accountId: string;
  password: string;
  nftAddresses: string[];
  toAddress: string;
  comment?: string;
  nfts?: ApiNft[];
}) {
  const {
    accountId, password, nftAddresses, toAddress, comment, nfts,
  } = options;

  const fromAddress = await fetchStoredAddress(accountId);

  const messages = nftAddresses.map((nftAddress, index) => {
    const nft = nfts?.[index];
    const isNotcoinBurn = nft?.collectionAddress === NOTCOIN_VOUCHERS_ADDRESS
      && (toAddress === BURN_ADDRESS || NOTCOIN_EXCHANGERS.includes(toAddress as any));
    const payload = isNotcoinBurn
      ? buildNotcoinVoucherExchange(fromAddress, nftAddress, nft!.index)
      : buildNftTransferPayload(fromAddress, toAddress, comment);

    return {
      payload,
      amount: NFT_TRANSFER_AMOUNT,
      toAddress: nftAddress,
    };
  });

  return submitMultiTransfer(accountId, password, messages);
}

function buildNotcoinVoucherExchange(fromAddress: string, nftAddress: string, nftIndex: number) {
  // eslint-disable-next-line no-bitwise
  const first4Bits = Address.parse(nftAddress).hash.readUint8() >> 4;
  const toAddress = NOTCOIN_EXCHANGERS[first4Bits];

  const payload = new Builder()
    .storeUint(0x5fec6642, 32)
    .storeUint(nftIndex, 64)
    .endCell();

  return buildNftTransferPayload(fromAddress, toAddress, payload, NOTCOIN_FORWARD_TON_AMOUNT);
}

function buildNftTransferPayload(
  fromAddress: string,
  toAddress: string,
  payload?: string | Cell,
  forwardAmount = NFT_TRANSFER_FORWARD_AMOUNT,
) {
  let builder = new Builder()
    .storeUint(NftOpCode.TransferOwnership, 32)
    .storeUint(generateQueryId(), 64)
    .storeAddress(Address.parse(toAddress))
    .storeAddress(Address.parse(fromAddress))
    .storeBit(false) // null custom_payload
    .storeCoins(forwardAmount);

  let forwardPayload: Cell | Uint8Array | undefined;

  if (payload) {
    if (typeof payload === 'string') {
      const bytes = commentToBytes(payload);
      const freeBytes = Math.floor(builder.availableBits / 8);
      forwardPayload = packBytesAsSnake(bytes, freeBytes);
    } else {
      forwardPayload = payload;
    }
  }

  if (forwardPayload instanceof Uint8Array) {
    builder.storeBit(0);
    builder = builder.storeBuffer(Buffer.from(forwardPayload));
  } else {
    builder = builder.storeMaybeRef(forwardPayload);
  }

  return builder.endCell();
}
