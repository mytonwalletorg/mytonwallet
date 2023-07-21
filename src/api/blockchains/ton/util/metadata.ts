import type { Address, DictionaryValue } from 'ton-core';
import {
  BitReader, BitString, Builder, Cell, Dictionary, Slice,
} from 'ton-core';

import type { ApiNetwork, ApiParsedPayload } from '../../../types';
import type { ApiTransactionExtra, JettonMetadata } from '../types';

import { pick, range } from '../../../../util/iteratees';
import { logDebugError } from '../../../../util/logs';
import { base64ToString, handleFetchErrors, sha256 } from '../../../common/utils';
import { JettonOpCode, NftOpCode, OpCode } from '../constants';
import { buildTokenSlug } from './index';
import { fetchNftItems } from './tonapiio';
import { getJettonMinterData, resolveTokenMinterAddress } from './tonweb';

const IPFS_GATEWAY_BASE_URL: string = 'https://ipfs.io/ipfs/';

const ONCHAIN_CONTENT_PREFIX = 0x00;
const SNAKE_PREFIX = 0x00;

export function parseJettonWalletMsgBody(body?: string) {
  if (!body) return undefined;

  try {
    let slice = Cell.fromBase64(body).beginParse();
    const opCode = slice.loadUint(32);
    const queryId = slice.loadUint(64);

    if (opCode === JettonOpCode.Transfer || opCode === JettonOpCode.InternalTransfer) {
      const jettonAmount = slice.loadCoins();
      const address = slice.loadMaybeAddress();
      const responseAddress = slice.loadMaybeAddress();
      let forwardAmount: bigint | undefined;
      let forwardComment: string | undefined;

      if (responseAddress) {
        if (opCode === JettonOpCode.Transfer) {
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
        operation: JettonOpCode[opCode] as keyof typeof JettonOpCode,
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

export async function parseWalletTransactionBody(
  network: ApiNetwork, transaction: ApiTransactionExtra,
): Promise<ApiTransactionExtra> {
  const body = transaction.extraData?.body;
  if (!body) return transaction;

  try {
    const slice = dataToSlice(body);

    if (slice.remainingBits > 32) {
      const parsedPayload = await parsePayloadSlice(network, transaction.toAddress, slice);

      if (parsedPayload?.type === 'encrypted-comment') {
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
      const comment = slice.loadStringTail();
      return { type: 'comment', comment };
    } else if (opCode === OpCode.Encrypted) {
      const encryptedComment = slice.loadBuffer(slice.remainingBits / 8).toString('base64');
      return { type: 'encrypted-comment', encryptedComment };
    }

    const queryId = slice.loadUint(64).toString();

    switch (opCode) {
      case JettonOpCode.Transfer: {
        const minterAddress = await resolveTokenMinterAddress(network, toAddress);
        const slug = buildTokenSlug(minterAddress);

        const amount = slice.loadCoins();
        const destination = slice.loadAddress();
        const responseDestination = slice.loadMaybeAddress();

        if (!responseDestination) {
          return {
            type: 'transfer-tokens:non-standard',
            queryId,
            destination: toBounceableAddress(destination),
            amount: amount.toString(),
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
          type: 'transfer-tokens',
          queryId,
          amount: amount.toString(),
          destination: toBounceableAddress(destination),
          responseDestination: toBounceableAddress(responseDestination),
          customPayload: customPayload?.toBoc().toString('base64'),
          forwardAmount: forwardAmount.toString(),
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
          type: 'transfer-nft',
          queryId,
          newOwner: toBounceableAddress(newOwner),
          responseDestination: toBounceableAddress(responseDestination),
          customPayload: customPayload?.toBoc().toString('base64'),
          forwardAmount: forwardAmount.toString(),
          forwardPayload: forwardPayload?.toBoc().toString('base64'),
          nftAddress,
          nftName: nft?.metadata?.name,
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
