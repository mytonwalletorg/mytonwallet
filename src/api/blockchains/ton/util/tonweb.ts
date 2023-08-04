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
} from '../../../../config';
import withCacheAsync from '../../../../util/withCacheAsync';
import { hexToBytes } from '../../../common/utils';
import { JettonOpCode } from '../constants';
import { parseTxId, stringifyTxId } from './index';

import CustomHttpProvider from './CustomHttpProvider';

const { Cell } = TonWeb.boc;
const { Address } = TonWeb.utils;
const { JettonMinter, JettonWallet } = TonWeb.token.jetton;

const tonwebByNetwork = {
  mainnet: new TonWeb(new CustomHttpProvider(TONHTTPAPI_MAINNET_URL, {
    apiKey: TONHTTPAPI_MAINNET_API_KEY,
  })) as MyTonWeb,
  testnet: new TonWeb(new CustomHttpProvider(TONHTTPAPI_TESTNET_URL, {
    apiKey: TONHTTPAPI_TESTNET_API_KEY,
  })) as MyTonWeb,
};

export const resolveTokenWalletAddress = withCacheAsync(
  async (network: ApiNetwork, address: string, minterAddress: string) => {
    const minter = new JettonMinter(getTonWeb(network).provider, { address: minterAddress } as any);
    return toBase64Address(await minter.getJettonWalletAddress(new Address(address)));
  },
);

export const resolveTokenMinterAddress = withCacheAsync(async (network: ApiNetwork, tokenWalletAddress: string) => {
  const tokenWallet = new JettonWallet(getTonWeb(network).provider, { address: tokenWalletAddress } as any);
  return toBase64Address((await tokenWallet.getData()).jettonMinterAddress);
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
    adminAddress: data.adminAddress ? toBase64Address(data.adminAddress) : undefined,
  };
}

export async function fetchNewestTxId(network: ApiNetwork, address: string) {
  const tonWeb = getTonWeb(network);

  const result: any[] = await tonWeb.provider.getTransactions(
    address,
    1,
    undefined,
    undefined,
    undefined,
    true,
  );
  if (!result?.length) {
    return undefined;
  }

  return stringifyTxId(result[0].transaction_id);
}

export async function fetchTransactions(
  network: ApiNetwork, address: string, limit: number, fromTxId?: string, toTxId?: string,
): Promise<ApiTransactionExtra[]> {
  const tonWeb = getTonWeb(network);

  const fromLt = fromTxId ? parseTxId(fromTxId).lt : undefined;
  const fromHash = fromTxId ? parseTxId(fromTxId).hash : undefined;
  const toLt = toTxId ? parseTxId(toTxId).lt : undefined;

  let rawTransactions = await tonWeb.provider.getTransactions(
    address, limit, fromLt, fromHash, toLt, true,
  ) as any[];

  if (
    fromTxId
    && rawTransactions.length
    && Number(rawTransactions[0].transaction_id.lt) === fromLt
    && rawTransactions[0].transaction_id.hash === fromHash
  ) {
    rawTransactions = rawTransactions.slice(1);
  }

  return rawTransactions.map(parseRawTransaction).flat();
}

function parseRawTransaction(rawTx: any): ApiTransactionExtra[] {
  const {
    utime,
    transaction_id: {
      lt,
      hash,
    },
    fee,
  } = rawTx;
  const txId = stringifyTxId({ lt, hash });
  const timestamp = utime as number * 1000;
  const isIncoming = !!rawTx.in_msg.source;
  const msgs: any[] = isIncoming ? [rawTx.in_msg] : rawTx.out_msgs;

  if (!msgs.length) return [];

  return msgs.map((msg, i) => {
    const { source, destination, value } = msg;
    return {
      txId: msgs.length > 1 ? `${txId}:${i + 1}` : txId,
      timestamp,
      isIncoming,
      fromAddress: source,
      toAddress: destination,
      amount: isIncoming ? value : `-${value}`,
      comment: getComment(msg),
      encryptedComment: getEncryptedComment(msg),
      slug: TON_TOKEN_SLUG,
      fee,
      extraData: {
        body: getRawBody(msg),
      },
    };
  });
}

function getComment(msg: any): string | undefined {
  if (!msg.msg_data) return undefined;
  if (msg.msg_data['@type'] !== 'msg.dataText') return undefined;
  const base64 = msg.msg_data.text;
  return new TextDecoder().decode(TonWeb.utils.base64ToBytes(base64));
}

function getEncryptedComment(msg: any): string | undefined {
  if (!msg.msg_data) return undefined;
  if (msg.msg_data['@type'] !== 'msg.dataEncryptedText') return undefined;
  return msg.msg_data.text;
}

function getRawBody(msg: any) {
  if (!msg.msg_data) return undefined;
  if (msg.msg_data['@type'] !== 'msg.dataRaw') return undefined;
  return msg.msg_data.body;
}

export function getTonWeb(network: ApiNetwork = 'mainnet') {
  return tonwebByNetwork[network];
}

export function oneCellFromBoc(boc: Uint8Array) {
  return TonWeb.boc.Cell.oneFromBoc(boc);
}

export function toBase64Address(address: AddressType, isBounceable = true) {
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

  // A large comment must be placed in a separate cell
  if (typeof forwardPayload === 'string') {
    const buffer = Buffer.from(forwardPayload);
    if (cell.bits.getFreeBits() < (buffer.length * 8) + 32 + 1) {
      forwardPayload = new Cell();
      forwardPayload.bits.writeUint(0, 32);
      forwardPayload.bits.writeBytes(buffer);
    }
  } else if (forwardPayload instanceof Uint8Array && cell.bits.getFreeBits() < forwardPayload.length * 8) {
    const bytes = forwardPayload;
    forwardPayload = new Cell();
    forwardPayload.bits.writeBytes(bytes);
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
