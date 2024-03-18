import type { DictionaryValue } from '@ton/core';
import { BitReader } from '@ton/core/dist/boc/BitReader';
import { BitString } from '@ton/core/dist/boc/BitString';
import { Builder } from '@ton/core/dist/boc/Builder';
import { Cell } from '@ton/core/dist/boc/Cell';
import { Slice } from '@ton/core/dist/boc/Slice';
import { Dictionary } from '@ton/core/dist/dict/Dictionary';

import type { ApiNetwork, ApiParsedPayload } from '../../../types';
import type { ApiTransactionExtra, JettonMetadata } from '../types';

import { LIQUID_JETTON } from '../../../../config';
import { pick, range } from '../../../../util/iteratees';
import { logDebugError } from '../../../../util/logs';
import { fetchJsonMetadata } from '../../../../util/metadata';
import { base64ToString, sha256 } from '../../../common/utils';
import {
  JettonOpCode, LiquidStakingOpCode, NftOpCode, OpCode,
} from '../constants';
import { buildTokenSlug } from './index';
import { fetchNftItems } from './tonapiio';
import { getJettonMinterData, resolveTokenMinterAddress, toBase64Address } from './tonCore';

const OFFCHAIN_CONTENT_PREFIX = 0x01;
const SNAKE_PREFIX = 0x00;

export function parseJettonWalletMsgBody(network: ApiNetwork, body?: string) {
  if (!body) return undefined;

  try {
    let slice = Cell.fromBase64(body).beginParse();
    const opCode = slice.loadUint(32);
    const queryId = slice.loadUint(64);

    if (opCode !== JettonOpCode.Transfer && opCode !== JettonOpCode.InternalTransfer) {
      return undefined;
    }

    const jettonAmount = slice.loadCoins();
    const address = slice.loadMaybeAddress();
    const responseAddress = slice.loadMaybeAddress();
    let forwardAmount: bigint | undefined;
    let comment: string | undefined;
    let encryptedComment: string | undefined;

    if (responseAddress) {
      if (opCode === JettonOpCode.Transfer) {
        slice.loadBit();
      }
      forwardAmount = slice.loadCoins();
      const isSeparateCell = slice.remainingBits && slice.loadBit();
      if (isSeparateCell && slice.remainingRefs) {
        slice = slice.loadRef().beginParse();
      }
      if (slice.remainingBits > 32) {
        const forwardOpCode = slice.loadUint(32);
        if (forwardOpCode === OpCode.Comment) {
          const buffer = readSnakeBytes(slice);
          comment = buffer.toString('utf-8');
        } else if (forwardOpCode === OpCode.Encrypted) {
          const buffer = readSnakeBytes(slice);
          encryptedComment = buffer.toString('base64');
        }
      }
    }

    return {
      operation: JettonOpCode[opCode] as keyof typeof JettonOpCode,
      queryId,
      jettonAmount,
      responseAddress,
      address: address ? toBase64Address(address, undefined, network) : undefined,
      forwardAmount,
      comment,
      encryptedComment,
    };
  } catch (err) {
    logDebugError('parseJettonWalletMsgBody', err);
  }

  return undefined;
}

export function fixBase64ImageData(data: string) {
  const decodedData = base64ToString(data);
  if (decodedData.includes('<svg')) {
    return `data:image/svg+xml;base64,${data}`;
  }
  return `data:image/png;base64,${data}`;
}

const dictSnakeBufferValue: DictionaryValue<Buffer> = {
  parse: (slice) => {
    const buffer = Buffer.from('');

    const sliceToVal = (s: Slice, v: Buffer, isFirst: boolean) => {
      if (isFirst && s.loadUint(8) !== SNAKE_PREFIX) {
        throw new Error('Only snake format is supported');
      }

      v = Buffer.concat([v, s.loadBuffer(s.remainingBits / 8)]);
      if (s.remainingRefs === 1) {
        v = sliceToVal(s.loadRef().beginParse(), v, false);
      }

      return v;
    };

    return sliceToVal(slice.loadRef().beginParse() as any, buffer, true);
  },
  serialize: () => {
    // pass
  },
};

const jettonOnChainMetadataSpec: {
  [key in keyof JettonMetadata]: 'utf8' | 'ascii' | undefined;
} = {
  uri: 'ascii',
  name: 'utf8',
  description: 'utf8',
  image: 'ascii',
  symbol: 'utf8',
  decimals: 'utf8',
};

export async function fetchJettonMetadata(network: ApiNetwork, address: string) {
  const { content } = await getJettonMinterData(network, address);

  let metadata: JettonMetadata;

  const slice = content.asSlice();
  const prefix = slice.loadUint(8);

  if (prefix === OFFCHAIN_CONTENT_PREFIX) {
    const bytes = readSnakeBytes(slice);
    const contentUri = bytes.toString('utf-8');
    metadata = await fetchJettonOffchainMetadata(contentUri);
  } else {
    // On-chain content
    metadata = await parseJettonOnchainMetadata(slice);
    if (metadata.uri) {
      // Semi-chain content
      const offchainMetadata = await fetchJettonOffchainMetadata(metadata.uri);
      metadata = { ...offchainMetadata, ...metadata };
    }
  }

  return metadata;
}

export async function parseJettonOnchainMetadata(slice: Slice): Promise<JettonMetadata> {
  const dict = slice.loadDict(Dictionary.Keys.Buffer(32), dictSnakeBufferValue);

  const res: { [s in keyof JettonMetadata]?: string } = {};

  for (const [key, value] of Object.entries(jettonOnChainMetadataSpec)) {
    const sha256Key = Buffer.from(await sha256(Buffer.from(key, 'ascii')));
    const val = dict.get(sha256Key)?.toString(value);

    if (val) {
      res[key as keyof JettonMetadata] = val;
    }
  }

  return res as JettonMetadata;
}

export async function fetchJettonOffchainMetadata(uri: string): Promise<JettonMetadata> {
  const metadata = await fetchJsonMetadata(uri);
  return pick(metadata, ['name', 'description', 'symbol', 'decimals', 'image', 'image_data']);
}

export async function parseWalletTransactionBody(
  network: ApiNetwork, transaction: ApiTransactionExtra,
): Promise<ApiTransactionExtra> {
  const body = transaction.extraData?.body;
  if (!body || transaction.comment || transaction.encryptedComment) {
    return transaction;
  }

  try {
    const slice = dataToSlice(body);

    if (slice.remainingBits > 32) {
      const parsedPayload = await parsePayloadSlice(network, transaction.toAddress, slice);
      transaction.extraData!.parsedPayload = parsedPayload;

      if (parsedPayload?.type === 'comment') {
        transaction = {
          ...transaction,
          comment: parsedPayload.comment,
        };
      } else if (parsedPayload?.type === 'encrypted-comment') {
        transaction = {
          ...transaction,
          encryptedComment: parsedPayload.encryptedComment,
        };
      }
    }
  } catch (err) {
    logDebugError('parseTransactionBody', err);
  }

  return transaction;
}

export async function parsePayloadBase64(
  network: ApiNetwork, toAddress: string, base64: string,
): Promise<ApiParsedPayload> {
  const slice = dataToSlice(base64);
  const result: ApiParsedPayload = { type: 'unknown', base64 };

  if (!slice) return result;

  return await parsePayloadSlice(network, toAddress, slice) ?? result;
}

export async function parsePayloadSlice(
  network: ApiNetwork, toAddress: string, slice: Slice,
): Promise<ApiParsedPayload | undefined> {
  try {
    const opCode = slice.loadUint(32);

    if (opCode === OpCode.Comment) {
      const buffer = readSnakeBytes(slice);
      const comment = buffer.toString('utf-8');
      return { type: 'comment', comment };
    } else if (opCode === OpCode.Encrypted) {
      const buffer = readSnakeBytes(slice);
      const encryptedComment = buffer.toString('base64');
      return { type: 'encrypted-comment', encryptedComment };
    } else if (slice.remainingBits < 64) {
      return undefined;
    }

    const queryId = slice.loadUintBig(64);

    switch (opCode) {
      case JettonOpCode.Transfer: {
        const minterAddress = await resolveTokenMinterAddress(network, toAddress);
        const slug = buildTokenSlug(minterAddress);

        const amount = slice.loadCoins();
        const destination = slice.loadAddress();
        const responseDestination = slice.loadMaybeAddress();

        if (!responseDestination) {
          return {
            type: 'tokens:transfer-non-standard',
            queryId,
            destination: toBase64Address(destination, undefined, network),
            amount,
            slug,
          };
        }

        const customPayload = slice.loadMaybeRef();
        const forwardAmount = slice.loadCoins();
        let forwardPayload = slice.loadMaybeRef();
        if (!forwardPayload && slice.remainingBits) {
          const builder = new Builder().storeBits(slice.loadBits(slice.remainingBits));
          range(0, slice.remainingRefs).forEach(() => {
            builder.storeRef(slice.loadRef());
          });
          forwardPayload = builder.endCell();
        }

        return {
          type: 'tokens:transfer',
          queryId,
          amount,
          destination: toBase64Address(destination, undefined, network),
          responseDestination: toBase64Address(responseDestination, undefined, network),
          customPayload: customPayload?.toBoc().toString('base64'),
          forwardAmount,
          forwardPayload: forwardPayload?.toBoc().toString('base64'),
          slug,
        };
      }
      case NftOpCode.TransferOwnership: {
        const newOwner = slice.loadAddress();
        const responseDestination = slice.loadAddress();
        const customPayload = slice.loadMaybeRef();
        const forwardAmount = slice.loadCoins();

        let forwardPayload = slice.loadMaybeRef();
        if (!forwardPayload && slice.remainingBits) {
          const builder = new Builder().storeBits(slice.loadBits(slice.remainingBits));
          range(0, slice.remainingRefs).forEach(() => {
            builder.storeRef(slice.loadRef());
          });
          forwardPayload = builder.endCell();
        }

        const nftAddress = toAddress;
        const [nft] = await fetchNftItems(network, [nftAddress]);
        return {
          type: 'nft:transfer',
          queryId,
          newOwner: toBase64Address(newOwner, undefined, network),
          responseDestination: toBase64Address(responseDestination, undefined, network),
          customPayload: customPayload?.toBoc().toString('base64'),
          forwardAmount,
          forwardPayload: forwardPayload?.toBoc().toString('base64'),
          nftAddress,
          nftName: nft?.metadata?.name,
        };
      }
      case JettonOpCode.Burn: {
        const minterAddress = await resolveTokenMinterAddress(network, toAddress);
        const slug = buildTokenSlug(minterAddress);

        const amount = slice.loadCoins();
        const address = slice.loadAddress();
        const customPayload = slice.loadMaybeRef();
        const isLiquidUnstakeRequest = minterAddress === LIQUID_JETTON;

        return {
          type: 'tokens:burn',
          queryId,
          amount,
          address: toBase64Address(address, undefined, network),
          customPayload: customPayload?.toBoc().toString('base64'),
          slug,
          isLiquidUnstakeRequest,
        };
      }
      case LiquidStakingOpCode.DistributedAsset: {
        return {
          type: 'liquid-staking:withdrawal-nft',
          queryId,
        };
      }
      case LiquidStakingOpCode.Withdrawal: {
        return {
          type: 'liquid-staking:withdrawal',
          queryId,
        };
      }
      case LiquidStakingOpCode.Deposit: {
        // const amount = slice.loadCoins();
        return {
          type: 'liquid-staking:deposit',
          queryId,
        };
      }
    }
  } catch (err) {
    logDebugError('parsePayload', err);
  }

  return undefined;
}

function dataToSlice(data: string | Buffer | Uint8Array): Slice {
  let buffer: Buffer;
  if (typeof data === 'string') {
    buffer = Buffer.from(data, 'base64');
  } else if (data instanceof Buffer) {
    buffer = data;
  } else {
    buffer = Buffer.from(data);
  }

  try {
    return Cell.fromBoc(buffer)[0].beginParse();
  } catch (err: any) {
    if (err?.message !== 'Invalid magic') {
      throw err;
    }
  }

  return new Slice(new BitReader(new BitString(buffer, 0, buffer.length * 8)), []);
}

export function readSnakeBytes(slice: Slice) {
  let buffer = Buffer.alloc(0);

  while (slice.remainingBits >= 8) {
    buffer = Buffer.concat([buffer, slice.loadBuffer(slice.remainingBits / 8)]);
    if (slice.remainingRefs) {
      slice = slice.loadRef().beginParse();
    } else {
      break;
    }
  }

  return buffer;
}
