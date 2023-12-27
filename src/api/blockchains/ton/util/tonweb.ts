import type { AddressType } from 'tonweb';
import TonWeb from 'tonweb';
import type { Cell as CellType } from 'tonweb/dist/types/boc/cell';
import type { JettonData } from 'tonweb/dist/types/contract/token/ft/jetton-minter';
import BN from 'bn.js';

import type { ApiNetwork } from '../../../types';
import type { ApiTransactionExtra, MyTonWeb, TokenTransferBodyParams } from '../types';

import {
  TON_TOKEN_SLUG,
  TONHTTPAPI_MAINNET_API_KEY,
  TONHTTPAPI_MAINNET_URL,
  TONHTTPAPI_TESTNET_API_KEY,
  TONHTTPAPI_TESTNET_URL,
  TONINDEXER_MAINNET_URL,
  TONINDEXER_TESTNET_URL,
} from '../../../../config';
import { logDebugError } from '../../../../util/logs';
import withCacheAsync from '../../../../util/withCacheAsync';
import { base64ToBytes, fetchJson, hexToBytes } from '../../../common/utils';
import { getEnvironment } from '../../../environment';
import {
  DEFAULT_IS_BOUNCEABLE,
  JettonOpCode,
  LiquidStakingOpCode,
  OpCode,
} from '../constants';
import { parseTxId, stringifyTxId } from './index';

import CustomHttpProvider from './CustomHttpProvider';

const { Cell } = TonWeb.boc;
const { Address } = TonWeb.utils;
const { JettonMinter, JettonWallet } = TonWeb.token.jetton;
export const { toNano, fromNano } = TonWeb.utils;

const TON_MAX_COMMENT_BYTES = 127;

let tonwebByNetwork: Record<ApiNetwork, MyTonWeb> | undefined;

export const resolveTokenWalletAddress = withCacheAsync(
  async (network: ApiNetwork, address: string, minterAddress: string) => {
    const minter = new JettonMinter(getTonWeb(network).provider, { address: minterAddress } as any);
    return toBase64Address(await minter.getJettonWalletAddress(new Address(address)), true);
  },
);

export const resolveTokenMinterAddress = withCacheAsync(async (network: ApiNetwork, tokenWalletAddress: string) => {
  const tokenWallet = new JettonWallet(getTonWeb(network).provider, { address: tokenWalletAddress } as any);
  return toBase64Address((await tokenWallet.getData()).jettonMinterAddress, true);
});

export const getWalletPublicKey = withCacheAsync(async (network: ApiNetwork, address: string) => {
  try {
    const publicKeyBN = await getTonWeb(network).provider.call2(address, 'get_public_key');
    let publicKeyHex = publicKeyBN.toString(16);
    if (publicKeyHex.length % 2 !== 0) {
      publicKeyHex = `0${publicKeyHex}`;
    }

    return hexToBytes(publicKeyHex);
  } catch (err) {
    return undefined;
  }
});

export async function getJettonMinterData(network: ApiNetwork, address: string) {
  const contract = new JettonMinter(getTonWeb(network).provider, { address } as any);
  const data = await contract.getJettonData() as JettonData & {
    jettonContentCell: CellType;
  };
  return {
    ...data,
    totalSupply: data.totalSupply.toString(),
    adminAddress: data.adminAddress ? toBase64Address(data.adminAddress, false) : undefined,
  };
}

export async function fetchNewestTxId(network: ApiNetwork, address: string) {
  const transactions = await fetchTransactions(network, address, 1);

  if (!transactions.length) {
    return undefined;
  }

  return transactions[0].txId;
}

export async function fetchTransactions(
  network: ApiNetwork,
  address: string,
  limit: number,
  toTxId?: string,
  fromTxId?: string,
): Promise<ApiTransactionExtra[]> {
  const indexerUrl = network === 'testnet' ? TONINDEXER_TESTNET_URL : TONINDEXER_MAINNET_URL;
  const apiKey = network === 'testnet' ? TONHTTPAPI_TESTNET_API_KEY : TONHTTPAPI_MAINNET_API_KEY;

  const fromLt = fromTxId ? parseTxId(fromTxId).lt.toString() : undefined;
  const toLt = toTxId ? parseTxId(toTxId).lt.toString() : undefined;

  let rawTransactions: any[] = await fetchJson(`${indexerUrl}/transactions`, {
    account: address,
    limit,
    start_lt: fromLt,
    end_lt: toLt,
    sort: 'desc',
  }, {
    headers: {
      ...(apiKey && { 'X-Api-Key': apiKey }),
      ...getEnvironment().apiHeaders,
    },
  });

  if (!rawTransactions.length) {
    return [];
  }

  if (limit > 1) {
    if (fromLt && rawTransactions[rawTransactions.length - 1].lt === fromLt) {
      rawTransactions.pop();
    }

    if (toLt && rawTransactions[0]?.lt === toLt) {
      rawTransactions = rawTransactions.slice(1);
    }
  }

  return rawTransactions.map(parseRawTransaction).flat();
}

function parseRawTransaction(rawTx: any): ApiTransactionExtra[] {
  const {
    now,
    lt,
    hash,
    fee,
  } = rawTx;

  const txId = stringifyTxId({ lt, hash });
  const timestamp = now as number * 1000;
  const isIncoming = !!rawTx.in_msg.source;
  const msgs: any[] = isIncoming ? [rawTx.in_msg] : rawTx.out_msgs;

  if (!msgs.length) return [];

  return msgs.map((msg, i) => {
    const { source, destination, value } = msg;
    const normalizedAddress = toBase64Address(isIncoming ? source : destination, true);
    return {
      txId: msgs.length > 1 ? `${txId}:${i + 1}` : txId,
      timestamp,
      isIncoming,
      fromAddress: toBase64Address(source),
      toAddress: toBase64Address(destination),
      amount: isIncoming ? value : `-${value}`,
      slug: TON_TOKEN_SLUG,
      fee,
      extraData: {
        normalizedAddress,
        body: getRawBody(msg),
      },
    };
  });
}

function getRawBody(msg: any) {
  if (!msg.message_content) return undefined;
  return msg.message_content.body;
}

export function getTonWeb(network: ApiNetwork = 'mainnet') {
  if (!tonwebByNetwork) {
    tonwebByNetwork = {
      mainnet: new TonWeb(new CustomHttpProvider(TONHTTPAPI_MAINNET_URL, {
        apiKey: TONHTTPAPI_MAINNET_API_KEY,
        headers: getEnvironment().apiHeaders,
      })) as MyTonWeb,
      testnet: new TonWeb(new CustomHttpProvider(TONHTTPAPI_TESTNET_URL, {
        apiKey: TONHTTPAPI_TESTNET_API_KEY,
        headers: getEnvironment().apiHeaders,
      })) as MyTonWeb,
    };
  }

  return tonwebByNetwork[network];
}

export function oneCellFromBoc(boc: Uint8Array) {
  return TonWeb.boc.Cell.oneFromBoc(boc);
}

export function toBase64Address(address: AddressType, isBounceable = DEFAULT_IS_BOUNCEABLE) {
  return new TonWeb.utils.Address(address).toString(true, true, isBounceable);
}

export function toRawAddress(address: string) {
  return new TonWeb.utils.Address(address).toString(false);
}

export function buildTokenTransferBody(params: TokenTransferBodyParams) {
  const {
    queryId, tokenAmount, toAddress, responseAddress, forwardAmount,
  } = params;
  let forwardPayload = params.forwardPayload;

  const cell = new Cell();
  cell.bits.writeUint(JettonOpCode.Transfer, 32);
  cell.bits.writeUint(queryId || 0, 64);
  cell.bits.writeCoins(new BN(tokenAmount));
  cell.bits.writeAddress(new Address(toAddress));
  cell.bits.writeAddress(new Address(responseAddress));
  cell.bits.writeBit(false); // null custom_payload
  cell.bits.writeCoins(new BN(forwardAmount || '0'));

  if (forwardPayload instanceof Uint8Array) {
    const freeBytes = Math.round(cell.bits.getFreeBits() / 8);
    forwardPayload = packBytesAsSnake(forwardPayload, freeBytes);
  }

  if (!forwardPayload) {
    cell.bits.writeBit(false);
  } else if (typeof forwardPayload === 'string') {
    cell.bits.writeBit(false);
    cell.bits.writeUint(0, 32);
    cell.bits.writeBytes(Buffer.from(forwardPayload));
  } else if (forwardPayload instanceof Uint8Array) {
    cell.bits.writeBit(false);
    cell.bits.writeBytes(forwardPayload);
  } else {
    cell.bits.writeBit(true);
    cell.refs.push(forwardPayload);
  }

  return cell;
}

export function bnToAddress(value: BN) {
  return new Address(`0:${value.toString('hex', 64)}`).toString(true, true, true);
}

export function parseBase64(base64: string) {
  try {
    return Cell.oneFromBoc(base64ToBytes(base64));
  } catch (err) {
    logDebugError('parseBase64', err);
    return Uint8Array.from(Buffer.from(base64, 'base64'));
  }
}

export function commentToBytes(comment: string): Uint8Array {
  const buffer = Buffer.from(comment);
  const bytes = new Uint8Array(buffer.length + 4);

  const startBuffer = Buffer.alloc(4);
  startBuffer.writeUInt32BE(OpCode.Comment);
  bytes.set(startBuffer, 0);
  bytes.set(buffer, 4);

  return bytes;
}

export function packBytesAsSnake(bytes: Uint8Array, maxBytes = TON_MAX_COMMENT_BYTES): Uint8Array | CellType {
  const buffer = Buffer.from(bytes);
  if (buffer.length <= maxBytes) {
    return bytes;
  }

  const cell = new Cell();

  let subcell = cell;

  for (const byte of buffer) {
    if (subcell.bits.getFreeBits() < 8) {
      const newCell = new Cell();
      subcell.refs = [newCell];
      subcell = newCell;
    }
    subcell.bits.writeUint8(byte);
  }

  return cell;
}

export function buildLiquidStakingDepositBody(queryId?: number) {
  const cell = new Cell();
  cell.bits.writeUint(LiquidStakingOpCode.Deposit, 32);
  cell.bits.writeUint(queryId || 0, 64);
  return cell;
}

export function buildLiquidStakingWithdrawBody(options: {
  queryId?: number;
  amount: string | BN;
  responseAddress: AddressType;
  waitTillRoundEnd?: boolean; // opposite of request_immediate_withdrawal
  fillOrKill?: boolean;
}) {
  const {
    queryId, amount, responseAddress, waitTillRoundEnd, fillOrKill,
  } = options;

  const customPayload = new Cell();
  customPayload.bits.writeUint(Number(waitTillRoundEnd), 1);
  customPayload.bits.writeUint(Number(fillOrKill), 1);

  const cell = new Cell();
  cell.bits.writeUint(JettonOpCode.Burn, 32);
  cell.bits.writeUint(queryId ?? 0, 64);
  cell.bits.writeCoins(new BN(amount));
  cell.bits.writeAddress(new Address(responseAddress));
  cell.bits.writeBit(1);
  cell.refs.push(customPayload);

  return cell;
}

export async function getTokenBalance(network: ApiNetwork, walletAddress: string) {
  const jettonWallet = new JettonWallet(getTonWeb(network).provider, {
    address: walletAddress,
  });
  const wallletData = await jettonWallet.getData();
  return fromNano(wallletData.balance);
}
