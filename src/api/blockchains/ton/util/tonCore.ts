import type { OpenedContract } from '@ton/core';
import { Address, Builder, Cell } from '@ton/core';
import axios from 'axios';
import { WalletContractV1R1 } from '@ton/ton/dist/wallets/WalletContractV1R1';
import { WalletContractV1R2 } from '@ton/ton/dist/wallets/WalletContractV1R2';
import { WalletContractV1R3 } from '@ton/ton/dist/wallets/WalletContractV1R3';
import { WalletContractV2R1 } from '@ton/ton/dist/wallets/WalletContractV2R1';
import { WalletContractV2R2 } from '@ton/ton/dist/wallets/WalletContractV2R2';
import { WalletContractV3R1 } from '@ton/ton/dist/wallets/WalletContractV3R1';
import { WalletContractV3R2 } from '@ton/ton/dist/wallets/WalletContractV3R2';
import { WalletContractV4 } from '@ton/ton/dist/wallets/WalletContractV4';
import { WalletContractV5R1 } from '@ton/ton/dist/wallets/WalletContractV5R1';

import type { ApiDnsZone, ApiNetwork, ApiWalletVersion } from '../../../types';
import type { TokenTransferBodyParams } from '../types';

import {
  DEFAULT_TIMEOUT,
  TONHTTPAPI_MAINNET_API_KEY,
  TONHTTPAPI_MAINNET_URL,
  TONHTTPAPI_TESTNET_API_KEY,
  TONHTTPAPI_TESTNET_URL,
} from '../../../../config';
import axiosFetchAdapter from '../../../../lib/axios-fetch-adapter';
import { logDebugError } from '../../../../util/logs';
import withCacheAsync from '../../../../util/withCacheAsync';
import { DnsItem } from '../contracts/DnsItem';
import { JettonMinter } from '../contracts/JettonMaster';
import { JettonWallet } from '../contracts/JettonWallet';
import { hexToBytes } from '../../../common/utils';
import { getEnvironment } from '../../../environment';
import {
  DEFAULT_IS_BOUNCEABLE,
  DNS_ZONES_MAP,
  JettonOpCode,
  LiquidStakingOpCode,
  OpCode,
  WORKCHAIN,
} from '../constants';
import { generateQueryId } from './index';

import { TonClient } from './TonClient';

export type TonWalletType = typeof WalletContractV1R1
| typeof WalletContractV1R2
| typeof WalletContractV1R3
| typeof WalletContractV2R1
| typeof WalletContractV2R2
| typeof WalletContractV3R1
| typeof WalletContractV3R2
| typeof WalletContractV4
| typeof WalletContractV5R1;

export type TonWallet = OpenedContract<WalletContractV1R1
| WalletContractV1R2
| WalletContractV1R3
| WalletContractV2R1
| WalletContractV2R2
| WalletContractV3R1
| WalletContractV3R2
| WalletContractV4
| WalletContractV5R1>;

axios.defaults.adapter = axiosFetchAdapter;

const TON_MAX_COMMENT_BYTES = 127;

let clientByNetwork: Record<ApiNetwork, TonClient> | undefined;

export const walletClassMap: Record<ApiWalletVersion, TonWalletType> = {
  simpleR1: WalletContractV1R1,
  simpleR2: WalletContractV1R2,
  simpleR3: WalletContractV1R3,
  v2R1: WalletContractV2R1,
  v2R2: WalletContractV2R2,
  v3R1: WalletContractV3R1,
  v3R2: WalletContractV3R2,
  v4R2: WalletContractV4,
  W5: WalletContractV5R1,
};

export function getTonClient(network: ApiNetwork = 'mainnet') {
  if (!clientByNetwork) {
    clientByNetwork = {
      mainnet: new TonClient({
        endpoint: TONHTTPAPI_MAINNET_URL,
        timeout: DEFAULT_TIMEOUT,
        apiKey: TONHTTPAPI_MAINNET_API_KEY,
        headers: getEnvironment().apiHeaders,
      }),
      testnet: new TonClient({
        endpoint: TONHTTPAPI_TESTNET_URL,
        timeout: DEFAULT_TIMEOUT,
        apiKey: TONHTTPAPI_TESTNET_API_KEY,
        headers: getEnvironment().apiHeaders,
      }),
    };
  }

  return clientByNetwork[network];
}

export function getTonWalletContract(publicKeyHex: string, version: ApiWalletVersion) {
  const walletClass = walletClassMap[version];
  if (!walletClass) {
    throw new Error('Unsupported wallet contract version');
  }

  const publicKey = Buffer.from(hexToBytes(publicKeyHex));
  return walletClass.create({ workchain: WORKCHAIN, publicKey });
}

export const resolveTokenWalletAddress = withCacheAsync(
  async (network: ApiNetwork, address: string, minterAddress: string) => {
    const minter = getTonClient(network).open(new JettonMinter(Address.parse(minterAddress)));
    const walletAddress = await minter.getWalletAddress(Address.parse(address));
    return toBase64Address(walletAddress, true, network);
  },
);

export const resolveTokenMinterAddress = withCacheAsync(async (network: ApiNetwork, tokenWalletAddress: string) => {
  const tokenWallet = getTonClient(network).open(new JettonWallet(Address.parse(tokenWalletAddress)));
  const data = await tokenWallet.getWalletData();
  return toBase64Address(data.minter, true, network);
});

export const getWalletPublicKey = withCacheAsync(async (network: ApiNetwork, address: string) => {
  try {
    const res = await getTonClient(network).callGetMethod(Address.parse(address), 'get_public_key');
    const bigintKey = res.stack.readBigNumber();
    const hex = bigintKey.toString(16).padStart(64, '0');
    return hexToBytes(hex);
  } catch (err) {
    logDebugError('getWalletPublicKey', err);
    return undefined;
  }
});

export function getJettonMinterData(network: ApiNetwork, address: string) {
  const contract = getTonClient(network).open(new JettonMinter(Address.parse(address)));
  return contract.getJettonData();
}

export function oneCellFromBoc(bytes: Uint8Array) {
  return Cell.fromBoc(Buffer.from(bytes));
}

export function toBase64Address(address: Address | string, isBounceable = DEFAULT_IS_BOUNCEABLE, network?: ApiNetwork) {
  if (typeof address === 'string') {
    address = Address.parse(address);
  }
  return address.toString({
    urlSafe: true,
    bounceable: isBounceable,
    testOnly: network === 'testnet',
  });
}

export function toRawAddress(address: Address | string) {
  if (typeof address === 'string') {
    address = Address.parse(address);
  }
  return address.toRawString();
}

export function buildTokenTransferBody(params: TokenTransferBodyParams) {
  const {
    queryId, tokenAmount, toAddress, responseAddress, forwardAmount,
  } = params;
  let forwardPayload = params.forwardPayload;

  let builder = new Builder()
    .storeUint(JettonOpCode.Transfer, 32)
    .storeUint(queryId || generateQueryId(), 64)
    .storeCoins(tokenAmount)
    .storeAddress(Address.parse(toAddress))
    .storeAddress(Address.parse(responseAddress))
    .storeBit(false)
    .storeCoins(forwardAmount ?? 0n);

  if (forwardPayload instanceof Uint8Array) {
    const freeBytes = Math.round(builder.availableBits / 8);
    forwardPayload = packBytesAsSnake(forwardPayload, freeBytes);
  }

  if (!forwardPayload) {
    builder.storeBit(false);
  } else if (typeof forwardPayload === 'string') {
    builder = builder.storeBit(false)
      .storeUint(0, 32)
      .storeBuffer(Buffer.from(forwardPayload));
  } else if (forwardPayload instanceof Uint8Array) {
    builder = builder.storeBit(false)
      .storeBuffer(Buffer.from(forwardPayload));
  } else {
    builder = builder.storeBit(true)
      .storeRef(forwardPayload);
  }

  return builder.endCell();
}

export function parseBase64(base64: string) {
  try {
    return Cell.fromBase64(base64);
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

export function packBytesAsSnake(bytes: Uint8Array, maxBytes = TON_MAX_COMMENT_BYTES): Uint8Array | Cell {
  const buffer = Buffer.from(bytes);
  if (buffer.length <= maxBytes) {
    return bytes;
  }

  return packBytesAsSnakeCell(bytes);
}

export function packBytesAsSnakeCell(bytes: Uint8Array): Cell {
  const buffer = Buffer.from(bytes);

  const mainBuilder = new Builder();
  let prevBuilder: Builder | undefined;
  let currentBuilder = mainBuilder;

  for (const [i, byte] of buffer.entries()) {
    if (currentBuilder.availableBits < 8) {
      prevBuilder?.storeRef(currentBuilder);

      prevBuilder = currentBuilder;
      currentBuilder = new Builder();
    }

    currentBuilder = currentBuilder.storeUint(byte, 8);

    if (i === buffer.length - 1) {
      prevBuilder?.storeRef(currentBuilder);
    }
  }

  return mainBuilder.asCell();
}

function createNestedCell(data: Uint8Array, maxCellSize: number): Cell {
  const builder = new Builder();
  const dataSlice = Buffer.from(data.slice(0, maxCellSize));

  builder.storeBuffer(dataSlice);

  if (data.length > maxCellSize) {
    const remainingData = data.slice(maxCellSize);
    builder.storeRef(createNestedCell(remainingData, maxCellSize));
  }

  return builder.endCell();
}

export function packBytesAsSnakeForEncryptedData(data: Uint8Array): Uint8Array | Cell {
  const ROOT_BUILDER_BYTES = 39;
  const MAX_CELLS_AMOUNT = 16;

  const rootBuilder = new Builder();
  rootBuilder.storeBuffer(Buffer.from(data.slice(0, Math.min(data.length, ROOT_BUILDER_BYTES))));

  if (data.length > ROOT_BUILDER_BYTES + MAX_CELLS_AMOUNT * TON_MAX_COMMENT_BYTES) {
    throw new Error('Input text is too long');
  }

  rootBuilder.storeRef(createNestedCell(Buffer.from(data.slice(ROOT_BUILDER_BYTES)), TON_MAX_COMMENT_BYTES));

  return rootBuilder.endCell();
}

export function buildLiquidStakingDepositBody(queryId?: number) {
  return new Builder()
    .storeUint(LiquidStakingOpCode.Deposit, 32)
    .storeUint(queryId || 0, 64)
    .asCell();
}

export function buildLiquidStakingWithdrawBody(options: {
  queryId?: number;
  amount: bigint;
  responseAddress: string;
  waitTillRoundEnd?: boolean; // opposite of request_immediate_withdrawal
  fillOrKill?: boolean;
}) {
  const {
    queryId, amount, responseAddress, waitTillRoundEnd, fillOrKill,
  } = options;

  const customPayload = buildLiquidStakingWithdrawCustomPayload(waitTillRoundEnd, fillOrKill);

  return new Builder()
    .storeUint(JettonOpCode.Burn, 32)
    .storeUint(queryId ?? 0, 64)
    .storeCoins(amount)
    .storeAddress(Address.parse(responseAddress))
    .storeBit(1)
    .storeRef(customPayload)
    .asCell();
}

export function buildLiquidStakingWithdrawCustomPayload(waitTillRoundEnd?: boolean, fillOrKill?: boolean) {
  return new Builder()
    .storeUint(Number(waitTillRoundEnd), 1)
    .storeUint(Number(fillOrKill), 1)
    .asCell();
}

export function getTokenBalance(network: ApiNetwork, walletAddress: string) {
  const tokenWallet = getTonClient(network).open(new JettonWallet(Address.parse(walletAddress)));
  return tokenWallet.getJettonBalance();
}

export function parseAddress(address: string): {
  isValid: boolean;
  isRaw?: boolean;
  isUserFriendly?: boolean;
  isBounceable?: boolean;
  isTestOnly?: boolean;
  address?: Address;
} {
  try {
    if (Address.isRaw(address)) {
      return {
        address: Address.parseRaw(address),
        isRaw: true,
        isValid: true,
      };
    } else if (Address.isFriendly(address)) {
      return {
        ...Address.parseFriendly(address),
        isUserFriendly: true,
        isValid: true,
      };
    }
  } catch (err) {
    // Do nothing
  }

  return { isValid: false };
}

export function getIsRawAddress(address: string) {
  return Boolean(parseAddress(address).isRaw);
}

export async function getDnsItemDomain(network: ApiNetwork, address: Address | string) {
  if (typeof address === 'string') address = Address.parse(address);

  const contract = getTonClient(network)
    .open(new DnsItem(address));
  const nftData = await contract.getNftData();
  const collectionAddress = toBase64Address(nftData.collectionAddress, true);

  const zone = Object.entries(DNS_ZONES_MAP)
    .find(([, collection]) => collection === collectionAddress)?.[0] as ApiDnsZone | undefined;

  const base = zone === '.t.me'
    ? await contract.getTelemintDomain()
    : await contract.getDomain();

  return `${base}${zone}`;
}
