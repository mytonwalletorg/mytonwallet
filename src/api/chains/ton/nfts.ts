import type { Cell } from '@ton/core';
import { Address, Builder } from '@ton/core';

import type {
  ApiCheckTransactionDraftResult,
  ApiNft,
  ApiNftUpdate,
  ApiSubmitNftTransferResult,
} from '../../types';

import {
  BURN_ADDRESS,
  NFT_BATCH_SIZE,
} from '../../../config';
import { parseAccountId } from '../../../util/account';
import { bigintMultiplyToNumber } from '../../../util/bigint';
import { getChainConfig } from '../../../util/chain';
import { explainApiTransferFee } from '../../../util/fee/transferFee';
import { compact } from '../../../util/iteratees';
import { logDebug, logDebugError } from '../../../util/logs';
import { getNativeToken } from '../../../util/tokens';
import { generateQueryId } from './util';
import { getSigner } from './util/signer';
import { commentToBytes, packBytesAsSnakeCell, storeInlineOrRefCell, toBase64Address } from './util/tonCore';
import { fetchStoredChainAccount, fetchStoredWallet } from '../../common/accounts';
import { getNftSuperCollectionsByCollectionAddress } from '../../common/addresses';
import { fetchAllPaginated, streamPaginated } from '../../common/pagination';
import { parseToncenterNft } from './toncenter/actions';
import { fetchNftItems, fetchNftTransfers, parseNftItem, parseNftItems } from './toncenter/nfts';
import {
  NFT_PAYLOAD_SAFE_MARGIN,
  NFT_TRANSFER_AMOUNT,
  NFT_TRANSFER_FORWARD_AMOUNT,
  NFT_TRANSFER_REAL_AMOUNT,
  NftOpCode,
} from './constants';
import { checkMultiTransactionDraft, checkToAddress, submitMultiTransfer } from './transfer';
import { isActiveSmartContract } from './wallet';

const NFT_TRANSFER_BATCH_SIZE = 100;

export async function getAccountNfts(accountId: string, options?: {
  collectionAddress?: string;
  offset?: number;
  limit?: number;
}): Promise<ApiNft[]> {
  const { network } = parseAccountId(accountId);
  const { address } = await fetchStoredWallet(accountId, 'ton');
  const nftSuperCollectionsByCollectionAddress = await getNftSuperCollectionsByCollectionAddress();

  if (options?.offset !== undefined || options?.limit !== undefined) {
    const response = await fetchNftItems(network, { ownerAddress: address, ...options });
    return compact(parseNftItems(network, response, nftSuperCollectionsByCollectionAddress));
  }

  const { nftBatchLimit, nftBatchPauseMs } = getChainConfig('ton');
  const nfts = await fetchAllPaginated({
    batchLimit: nftBatchLimit!,
    pauseMs: nftBatchPauseMs!,
    fetchBatch: (cursor) => fetchNftItems(network, {
      ownerAddress: address,
      collectionAddress: options?.collectionAddress,
      offset: cursor * nftBatchLimit!,
      limit: nftBatchLimit!,
    }).then((response) => parseNftItems(network, response, nftSuperCollectionsByCollectionAddress)),
  });

  return compact(nfts);
}

export async function streamAllAccountNfts(accountId: string, options: {
  signal?: AbortSignal;
  onBatch: (nfts: ApiNft[]) => void;
}): Promise<void> {
  const { network } = parseAccountId(accountId);
  const { address } = await fetchStoredWallet(accountId, 'ton');
  const nftSuperCollectionsByCollectionAddress = await getNftSuperCollectionsByCollectionAddress();

  const { nftBatchLimit, nftBatchPauseMs } = getChainConfig('ton');
  await streamPaginated({
    signal: options.signal,
    batchLimit: nftBatchLimit!,
    pauseMs: nftBatchPauseMs!,
    fetchBatch: (cursor) => fetchNftItems(network, {
      ownerAddress: address,
      offset: cursor * nftBatchLimit!,
      limit: nftBatchLimit!,
    }).then((response) => parseNftItems(network, response, nftSuperCollectionsByCollectionAddress)),
    onBatch: (batch) => options.onBatch(compact(batch)),
  });
}

export async function checkNftOwnership(accountId: string, nftAddress: string) {
  const { network } = parseAccountId(accountId);
  const { address } = await fetchStoredWallet(accountId, 'ton');
  const nftSuperCollectionsByCollectionAddress = await getNftSuperCollectionsByCollectionAddress();

  const response = await fetchNftItems(network, { addresses: [nftAddress] });
  const item = response.nft_items[0];
  if (!item) return false;

  const nft = parseNftItem(network, item, response.metadata, nftSuperCollectionsByCollectionAddress);

  return address === nft?.ownerAddress;
}

export async function getNftUpdates(accountId: string, fromSec: number) {
  const { network } = parseAccountId(accountId);
  const { address } = await fetchStoredWallet(accountId, 'ton');
  const nftSuperCollectionsByCollectionAddress = await getNftSuperCollectionsByCollectionAddress();

  const { nft_transfers: transfers, metadata } = await fetchNftTransfers(network, {
    ownerAddress: address,
    startUtime: fromSec,
    limit: NFT_TRANSFER_BATCH_SIZE,
  });

  // The response is sorted from the newest to the oldest
  fromSec = transfers[0]?.transaction_now ?? fromSec;
  const updates: ApiNftUpdate[] = [];

  for (const transfer of transfers.slice().reverse()) {
    const nftAddress = toBase64Address(transfer.nft_address, true, network);
    const newOwnerAddress = toBase64Address(transfer.new_owner, false, network);

    if (Address.parse(newOwnerAddress).equals(Address.parse(address))) {
      const { nft } = parseToncenterNft(
        network,
        metadata,
        transfer.nft_address,
        nftSuperCollectionsByCollectionAddress,
        {
          rawCollectionAddress: transfer.nft_collection ?? undefined,
          // `/nft/transfers` reports no ownership, but the check above has just confirmed that this
          // transfer handed the NFT to our wallet
          ownerAddress: address,
        },
      );

      if (nft) {
        updates.push({ type: 'nftReceived', accountId, nftAddress, nft });
      }
    } else if (await isActiveSmartContract(network, newOwnerAddress)) {
      // A finished sale never hits this branch: its transfer goes from the sale contract to the
      // buyer, so the `owner_address` filter does not return it for the seller at all. The seller's
      // gallery catches up on the next full reload instead
      updates.push({ type: 'nftPutUpForSale', accountId, nftAddress });
    } else {
      updates.push({
        type: 'nftSent',
        accountId,
        chain: 'ton',
        nftAddress,
        newOwnerAddress,
      });
    }
  }

  return [fromSec, updates] as [number, ApiNftUpdate[]];
}

export async function checkNftTransferDraft(options: {
  accountId: string;
  nfts: ApiNft[];
  toAddress: string;
  comment?: string;
  isNftBurn?: boolean;
}): Promise<ApiCheckTransactionDraftResult> {
  const { accountId, nfts, comment, isNftBurn } = options;
  let { toAddress } = options;

  const { network } = parseAccountId(accountId);
  const account = await fetchStoredChainAccount(accountId, 'ton');
  const { address: fromAddress } = account.byChain.ton;

  toAddress = isNftBurn ? BURN_ADDRESS : toAddress;

  const result: ApiCheckTransactionDraftResult = await checkToAddress(network, toAddress);
  if ('error' in result) {
    return result;
  }

  toAddress = result.resolvedAddress!;

  const messages = nfts
    .slice(0, NFT_BATCH_SIZE) // We only need to check the first batch of a multi-transaction
    .map((nft) => buildNftTransferMessage(nft, fromAddress, toAddress, comment));

  logDebug('checkNftTransferDraft', 'Checking NFT transfer draft', {
    accountId,
    fromAddress,
    toAddress,
    nftsCount: nfts.length,
    hasComment: Boolean(comment),
    isNftBurn: Boolean(isNftBurn),
  });

  const checkResult = await checkMultiTransactionDraft(accountId, messages);

  let fee: bigint | undefined;
  let realFee: bigint | undefined;

  if (checkResult.emulation) {
    // todo: Use `received` from the emulation to calculate the real fee. Check what happens when the receiver is the same wallet.
    const batchFee = checkResult.emulation.networkFee;
    fee = calculateNftTransferFee(nfts.length, messages.length, batchFee, NFT_TRANSFER_AMOUNT);
    realFee = calculateNftTransferFee(nfts.length, messages.length, batchFee, NFT_TRANSFER_REAL_AMOUNT);
  }

  if (fee !== undefined) {
    result.explainedFee = explainApiTransferFee({
      fee,
      realFee: realFee ?? fee,
      tokenSlug: getNativeToken('ton').slug,
    });
  }

  if ('error' in checkResult) {
    result.error = checkResult.error;
  }

  return result;
}

export async function submitNftTransfers(options: {
  accountId: string;
  enclaveToken: string | undefined;
  nfts: ApiNft[];
  toAddress: string;
  comment?: string;
  isNftBurn?: boolean;
}): Promise<ApiSubmitNftTransferResult> {
  const {
    accountId, enclaveToken, nfts, comment, isNftBurn,
  } = options;

  let { toAddress } = options;

  toAddress = isNftBurn ? BURN_ADDRESS : toAddress;

  const account = await fetchStoredChainAccount(accountId, 'ton');
  const { address: fromAddress } = account.byChain.ton;

  const messages = nfts.map(
    (nft) => buildNftTransferMessage(nft, fromAddress, toAddress, comment),
  );

  logDebug('submitNftTransfers', 'Submitting NFT transfers', {
    accountId,
    fromAddress,
    toAddress,
    nftsCount: nfts.length,
    hasComment: Boolean(comment),
  });

  const sentTx = await submitMultiTransfer({
    accountId,
    signer: getSigner(accountId, account, enclaveToken),
    messages,
  });

  if ('error' in sentTx) {
    logDebugError('submitNftTransfers', {
      error: sentTx.error,
      accountId,
      fromAddress,
      toAddress,
      nftsCount: nfts.length,
    });
    return sentTx;
  }

  return {
    msgHashNormalized: sentTx.msgHashNormalized,
    transfers: sentTx.messages.map((e) => ({ toAddress: e.toAddress })),
  };
}

function buildNftTransferMessage(
  nft: ApiNft,
  fromAddress: string,
  toAddress: string,
  comment?: string,
) {
  const payload = buildNftTransferPayload({ fromAddress, toAddress, payload: comment });

  return {
    payload,
    amount: NFT_TRANSFER_AMOUNT,
    toAddress: nft.address,
  };
}

interface NftTransferPayloadParams {
  fromAddress: string;
  toAddress: string;
  payload?: string | Cell;
  /**
   * `payload` can be stored either at a tail of the root cell (i.e. inline) or as its ref.
   * This option forbids the inline variant. This requires more gas but safer.
   */
  noInlinePayload?: boolean;
  forwardAmount?: bigint;
}

export function buildNftTransferPayload({
  fromAddress,
  toAddress,
  payload,
  forwardAmount = NFT_TRANSFER_FORWARD_AMOUNT,
  noInlinePayload,
}: NftTransferPayloadParams) {
  const queryId = generateQueryId();

  // Schema definition: https://github.com/ton-blockchain/TEPs/blob/0d7989fba6f2d9cb08811bf47263a9b314dc5296/text/0062-nft-standard.md#1-transfer
  let builder = new Builder()
    .storeUint(NftOpCode.TransferOwnership, 32)
    .storeUint(queryId, 64)
    .storeAddress(Address.parse(toAddress))
    .storeAddress(Address.parse(fromAddress))
    .storeBit(false) // null custom_payload
    .storeCoins(forwardAmount);

  let forwardPayload: Cell | undefined;

  if (payload) {
    if (typeof payload === 'string') {
      forwardPayload = packBytesAsSnakeCell(commentToBytes(payload));
    } else {
      forwardPayload = payload;
    }
  }

  builder = storeInlineOrRefCell(builder, forwardPayload, NFT_PAYLOAD_SAFE_MARGIN, noInlinePayload);

  return builder.endCell();
}

export function calculateNftTransferFee(
  totalNftCount: number,
  // How many NFTs were added to the multi-transaction before estimating it
  estimatedBatchSize: number,
  // The blockchain fee of the estimated multi-transaction
  estimatedBatchBlockchainFee: bigint,
  // How much TON is attached to each NFT during the transfer
  amountPerNft: bigint,
) {
  const fullBatchCount = Math.floor(totalNftCount / estimatedBatchSize);
  let remainingBatchSize = totalNftCount % estimatedBatchSize;

  // The blockchain fee for the first NFT in a batch is almost twice higher than the fee for the other NFTs. Therefore,
  // simply using the average NFT fee to calculate the last incomplete batch fee gives an insufficient number. To fix
  // that, we increase the last batch size.
  //
  // A real life example:
  // 1 NFT  in the batch: 0.002939195 TON
  // 2 NFTs in the batch: 0.004470516 TON
  // 3 NFTs in the batch: 0.006001837 TON
  // 4 NFTs in the batch: 0.007533158 TON
  if (remainingBatchSize > 0 && remainingBatchSize < estimatedBatchSize) {
    remainingBatchSize += 1;
  }

  const totalBlockchainFee = bigintMultiplyToNumber(
    estimatedBatchBlockchainFee,
    (fullBatchCount * estimatedBatchSize + remainingBatchSize) / estimatedBatchSize,
  );
  return totalBlockchainFee + BigInt(totalNftCount) * amountPerNft;
}
