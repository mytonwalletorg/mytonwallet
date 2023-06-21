import type { AddressType } from 'tonweb';
import TonWeb from 'tonweb';
import type { Cell as CellType } from 'tonweb/dist/types/boc/cell';
import type { JettonData } from 'tonweb/dist/types/contract/token/ft/jetton-minter';
import BN from 'bn.js';

import type { ApiNetwork } from '../../../types';
import type { MyTonWeb, TokenTransferBodyParams } from '../types';

import {
  TONHTTPAPI_MAINNET_API_KEY,
  TONHTTPAPI_MAINNET_URL,
  TONHTTPAPI_TESTNET_API_KEY,
  TONHTTPAPI_TESTNET_URL,
} from '../../../../config';
import { JettonOpCode } from '../constants';
import { stringifyTxId } from './index';

const { Cell } = TonWeb.boc;
const { Address } = TonWeb.utils;
const { JettonMinter } = TonWeb.token.jetton;

const tonwebByNetwork = {
  mainnet: new TonWeb(
    new TonWeb.HttpProvider(TONHTTPAPI_MAINNET_URL, { apiKey: TONHTTPAPI_MAINNET_API_KEY }),
  ) as MyTonWeb,
  testnet: new TonWeb(
    new TonWeb.HttpProvider(TONHTTPAPI_TESTNET_URL, { apiKey: TONHTTPAPI_TESTNET_API_KEY }),
  ) as MyTonWeb,
};

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
  cell.bits.writeUint(JettonOpCode.transfer, 32);
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
  }

  if (!forwardPayload) {
    cell.bits.writeBit(false);
  } else if (typeof forwardPayload === 'string') {
    cell.bits.writeBit(false);
    cell.bits.writeUint(0, 32);
    cell.bits.writeBytes(Buffer.from(forwardPayload));
  } else {
    cell.bits.writeBit(true);
    cell.refs.push(forwardPayload);
  }

  return cell;
}

export function bnToAddress(value: BN) {
  return new Address(`0:${value.toString('hex', 64)}`).toString(true, true, true);
}

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
