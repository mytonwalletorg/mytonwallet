import { TronWeb } from 'tronweb';

import type { ApiNetwork, ApiTransactionActivity } from '../../types';

import { getChainConfig, TRX } from '../../../config';
import { parseAccountId } from '../../../util/account';
import { compareActivities } from '../../../util/compareActivities';
import { fetchJson } from '../../../util/fetch';
import { buildCollectionByKey } from '../../../util/iteratees';
import { fetchStoredTronWallet } from '../../common/accounts';
import { buildTokenSlug, getTokenBySlug } from '../../common/tokens';

export async function getTokenTransactionSlice(
  accountId: string,
  slug: string,
  toTimestamp?: number,
  fromTimestamp?: number,
  limit?: number,
) {
  const { network } = parseAccountId(accountId);
  const { address } = await fetchStoredTronWallet(accountId);

  if (slug === TRX.slug) {
    const rawTransactions = await getTrxTransactions(network, address, {
      min_timestamp: fromTimestamp ? fromTimestamp + 1000 : undefined,
      max_timestamp: toTimestamp ? toTimestamp - 1000 : undefined,
      limit,
    });
    return rawTransactions.map((rawTx) => parseRawTrxTransaction(address, rawTx)).filter(Boolean);
  } else {
    const { tokenAddress } = getTokenBySlug(slug);
    const rawTransactions = await getTrc20Transactions(network, address, {
      contract_address: tokenAddress,
      min_timestamp: fromTimestamp ? fromTimestamp + 1000 : undefined,
      max_timestamp: toTimestamp ? toTimestamp - 1000 : undefined,
      limit,
    });
    return rawTransactions.map((rawTx) => parseRawTrc20Transaction(address, rawTx));
  }
}

export async function getAllTransactionSlice(
  accountId: string,
  toTimestamp: number,
  limit: number,
  tokenSlugs: string[],
) {
  const chunks = (await Promise.all([
    getTokenTransactionSlice(accountId, TRX.slug, toTimestamp, undefined, limit),
    ...tokenSlugs.map((slug) => getTokenTransactionSlice(
      accountId, slug, toTimestamp, undefined, limit,
    )),
  ])).filter((chunk) => chunk.length);

  if (!chunks.length) {
    return [];
  }

  // TODO Нужно, чтобы чанки всегда именли "все транзакции", так как это всё работает только при корректной работе лимита.
  // А только потом должна быть очистка от ненужных транзакций.
  const mainChunk = chunks.reduce((prevChunk, chunk) => {
    if (prevChunk.length > chunk.length) return prevChunk;
    if (prevChunk.length < chunk.length) return chunk;
    if (prevChunk[prevChunk.length - 1].timestamp < chunk[chunk.length - 1].timestamp) return chunk;
    return prevChunk;
  }, [] as ApiTransactionActivity[]);

  const fromTimestamp = mainChunk[mainChunk.length - 1].timestamp;

  const [trxChunk, ...tokenChunks] = chunks;

  return mergeTransactions(trxChunk, tokenChunks.flat())
    .flat()
    .filter(({ timestamp }) => timestamp >= fromTimestamp)
    .sort(compareActivities);
}

async function getTrxTransactions(
  network: ApiNetwork,
  address: string,
  queryParams: {
    only_confirmed?: boolean;
    only_unconfirmed?: boolean;
    only_to?: boolean;
    only_from?: boolean;
    limit?: number;
    fingerprint?: string;
    order_by?: 'block_timestamp,asc' | 'block_timestamp,desc';
    min_timestamp?: number;
    max_timestamp?: number;
    search_internal?: boolean;
  } = {},
): Promise<any[]> {
  const baseUrl = getChainConfig('tron')[network].apiUrl;
  const url = new URL(`${baseUrl}/v1/accounts/${address}/transactions`);

  const result = await fetchJson(url.toString(), queryParams);

  return result.data;
}

function parseRawTrxTransaction(address: string, rawTx: any): ApiTransactionActivity | undefined {
  const {
    raw_data: rawData,
    txID: txId,
    energy_fee: energyFee,
    net_fee: netFee,
    block_timestamp: timestamp,
  } = rawTx;

  const amount = BigInt(rawData.contract[0].parameter.value.amount ?? 0);
  const fromAddress = TronWeb.address.fromHex(rawData.contract[0].parameter.value.owner_address);
  const toAddress = TronWeb.address.fromHex(rawData.contract[0].parameter.value.to_address!);

  const slug = TRX.slug;
  const isIncoming = toAddress === address;
  const normalizedAddress = isIncoming ? fromAddress : toAddress;
  const fee = BigInt(energyFee + netFee);
  const shouldHide = rawData.contract[0].type === 'TransferAssetContract';

  return {
    id: txId,
    kind: 'transaction',
    txId,
    timestamp,
    fromAddress,
    toAddress,
    amount: isIncoming ? amount : -amount,
    slug,
    isIncoming,
    normalizedAddress,
    fee,
    shouldHide,
  };
}

async function getTrc20Transactions(
  network: ApiNetwork,
  address: string,
  queryParams: {
    only_confirmed?: boolean;
    only_unconfirmed?: boolean;
    limit?: number;
    fingerprint?: string;
    order_by?: 'block_timestamp,asc' | 'block_timestamp,desc';
    min_timestamp?: number;
    max_timestamp?: number;
    contract_address?: string;
    only_to?: boolean;
    only_from?: boolean;
  } = {},
): Promise<any[]> {
  const baseUrl = getChainConfig('tron')[network].apiUrl;
  const url = new URL(`${baseUrl}/v1/accounts/${address}/transactions/trc20`);

  const result = await fetchJson(url.toString(), queryParams);

  return result.data;
}

function parseRawTrc20Transaction(address: string, rawTx: any): ApiTransactionActivity {
  const {
    transaction_id: txId,
    block_timestamp: timestamp,
    from: fromAddress,
    to: toAddress,
    value,
    token_info: tokenInfo,
  } = rawTx;

  const amount = BigInt(value);
  const slug = buildTokenSlug(TRX.chain, tokenInfo.address);
  const isIncoming = toAddress === address;
  const normalizedAddress = isIncoming ? fromAddress : toAddress;
  const fee = 0n;

  return {
    id: txId,
    kind: 'transaction',
    txId,
    timestamp,
    fromAddress,
    toAddress,
    amount: isIncoming ? amount : -amount,
    slug,
    isIncoming,
    normalizedAddress,
    fee,
  };
}

export function mergeTransactions(trxTxs: ApiTransactionActivity[], tokenTxs: ApiTransactionActivity[]) {
  const tokenTxById = buildCollectionByKey(tokenTxs, 'id');
  const trxTxsCleared: ApiTransactionActivity[] = [];

  for (const tx of trxTxs) {
    const tokenTx = tokenTxById[tx.id];
    if (tx.toAddress) {
      trxTxsCleared.push(tx);
    } else if (tokenTx) {
      tokenTx.fee = tx.fee;
    }
  }

  return [trxTxsCleared, tokenTxs];
}
