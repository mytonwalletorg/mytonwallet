import type { Address, DictionaryValue } from 'ton-core';
import {
  BitReader, BitString, Cell, Dictionary, Slice,
} from 'ton-core';

import type { ApiNetwork } from '../../../types';
import type { ApiTransactionExtra, JettonMetadata } from '../types';

import { pick } from '../../../../util/iteratees';
import { logDebugError } from '../../../../util/logs';
import { base64ToString, handleFetchErrors, sha256 } from '../../../common/utils';
import { JettonOpCode, OpCode } from '../constants';
import { getJettonMinterData } from './tonweb';

const IPFS_GATEWAY_BASE_URL: string = 'https://ipfs.io/ipfs/';

const ONCHAIN_CONTENT_PREFIX = 0x00;
const SNAKE_PREFIX = 0x00;

export function parseJettonWalletMsgBody(body?: string) {
  if (!body) return undefined;

  try {
    let slice = Cell.fromBase64(body).beginParse();
    const opCode = slice.loadUint(32);
    const queryId = slice.loadUint(64);

    if (opCode === JettonOpCode.transfer || opCode === JettonOpCode.internalTransfer) {
      const jettonAmount = slice.loadCoins();
      const address = slice.loadMaybeAddress();
      const responseAddress = slice.loadMaybeAddress();
      let forwardAmount: bigint | undefined;
      let forwardComment: string | undefined;

      if (responseAddress) {
        if (opCode === JettonOpCode.transfer) {
          slice.loadBit();
        }
        forwardAmount = slice.loadCoins();
        const isSeparateCell = slice.remainingBits && slice.loadBit();
        if (isSeparateCell && slice.remainingRefs) {
          slice = slice.loadRef().beginParse();
        }
        if (slice.remainingBits > 32 && slice.loadUint(32) === 0) {
          forwardComment = slice.loadStringTail();
        }
      }

      return {
        operation: JettonOpCode[opCode],
        queryId,
        jettonAmount,
        responseAddress,
        address: address ? toBounceableAddress(address) : undefined,
        forwardAmount,
        forwardComment,
      };
    }
  } catch (err) {
    logDebugError('parseJettonWalletMsgBody', err);
  }

  return undefined;
}

export function toBounceableAddress(address: Address) {
  return address.toString({ urlSafe: true, bounceable: true });
}

export function fixIpfsUrl(url: string) {
  return url.replace('ipfs://', IPFS_GATEWAY_BASE_URL);
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

export async function getJettonMetadata(network: ApiNetwork, address: string) {
  const { jettonContentUri, jettonContentCell } = await getJettonMinterData(network, address);

  let metadata: JettonMetadata;

  if (jettonContentUri) {
    // Off-chain content
    metadata = await fetchJettonMetadata(jettonContentUri);
  } else {
    // On-chain content
    metadata = await parseJettonOnchainMetadata(await jettonContentCell.toBoc());
    if (metadata.uri) {
      // Semi-chain content
      const offchainMetadata = await fetchJettonMetadata(metadata.uri);
      metadata = { ...offchainMetadata, ...metadata };
    }
  }

  return metadata;
}

export async function parseJettonOnchainMetadata(array: Uint8Array): Promise<JettonMetadata> {
  const contentCell = Cell.fromBoc(Buffer.from(array))[0];
  const contentSlice = contentCell.beginParse();

  if (contentSlice.loadUint(8) !== ONCHAIN_CONTENT_PREFIX) {
    throw new Error('Expected onchain content marker');
  }

  const dict = contentSlice.loadDict(Dictionary.Keys.Buffer(32), dictSnakeBufferValue);

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

export async function fetchJettonMetadata(uri: string): Promise<JettonMetadata> {
  const metadata = await fetchJsonMetadata(uri);
  return pick(metadata, ['name', 'description', 'symbol', 'decimals', 'image', 'image_data']);
}

async function fetchJsonMetadata(uri: string) {
  uri = fixIpfsUrl(uri);

  const response = await fetch(uri);
  handleFetchErrors(response);
  return response.json();
}

export function parseTransactionBody(transaction: ApiTransactionExtra): ApiTransactionExtra {
  const body = transaction.extraData?.body;
  if (!body) return transaction;

  const payloadOffset = 13 * 8; // Wallet v3 or higher
  const buffer = Buffer.from(body, 'base64');
  let slice: Slice | undefined;

  try {
    slice = Cell.fromBoc(body)[0].beginParse();
  } catch (err: any) {
    if (err?.message !== 'Invalid magic') {
      logDebugError('parseTransactionBody', err);
      return transaction;
    }
  }

  try {
    if (!slice) {
      slice = new Slice(new BitReader(new BitString(buffer, 0, buffer.length * 8)), []);
    }

    if (slice.remainingBits > payloadOffset + 32) {
      slice.skip(payloadOffset);
      const opCode = slice.loadUint(32);

      if (opCode === OpCode.Encrypted) {
        const encryptedComment = slice.loadBuffer(slice.remainingBits / 8).toString('base64');
        transaction = { ...transaction, encryptedComment };
      }
    }
  } catch (err) {
    logDebugError('parseTransactionBody', err);
  }

  return transaction;
}
