/**
 * Copied from /src/api/chains/ton/util/tonCore.ts as tree shaking did not work for some reason.
 */

import { Address, Builder, Cell } from '@ton/core';

import { JettonOpCode } from '../../api/chains/ton/constants';
import { generateQueryId } from '../../api/chains/ton/util';

export type AnyPayload = string | Cell | Uint8Array;

interface TokenTransferBodyParams {
  queryId?: bigint;
  tokenAmount: bigint;
  toAddress: string;
  responseAddress: string;
  forwardAmount?: bigint;
  forwardPayload?: AnyPayload;
  customPayload?: Cell;
}

const TON_MAX_COMMENT_BYTES = 127;

// Copied from /src/api/chains/ton/util/tonCore.ts as tree shaking did not work for some reason
export function buildTokenTransferBody(params: TokenTransferBodyParams) {
  const {
    queryId,
    tokenAmount,
    toAddress,
    responseAddress,
    forwardAmount,
    customPayload,
  } = params;
  let forwardPayload = params.forwardPayload;

  let builder = new Builder()
    .storeUint(JettonOpCode.Transfer, 32)
    .storeUint(queryId || generateQueryId(), 64)
    .storeCoins(tokenAmount)
    .storeAddress(Address.parse(toAddress))
    .storeAddress(Address.parse(responseAddress))
    .storeMaybeRef(customPayload)
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

function packBytesAsSnake(bytes: Uint8Array, maxBytes = TON_MAX_COMMENT_BYTES): Uint8Array | Cell {
  const buffer = Buffer.from(bytes);
  if (buffer.length <= maxBytes) {
    return bytes;
  }

  return packBytesAsSnakeCell(bytes);
}

// Copied from /src/api/chains/ton/util/tonCore.ts as tree shaking did not work for some reason
function packBytesAsSnakeCell(bytes: Uint8Array): Cell {
  const bytesPerCell = TON_MAX_COMMENT_BYTES;
  const cellCount = Math.ceil(bytes.length / bytesPerCell);
  let headCell: Cell | undefined;

  for (let i = cellCount - 1; i >= 0; i--) {
    const cellOffset = i * bytesPerCell;
    const cellLength = Math.min(bytesPerCell, bytes.length - cellOffset);
    const cellBuffer = Buffer.from(bytes.buffer, bytes.byteOffset + cellOffset, cellLength); // This creates a buffer that references the input bytes instead of copying them

    const nextHeadCell = new Builder().storeBuffer(cellBuffer);
    if (headCell) {
      nextHeadCell.storeRef(headCell);
    }
    headCell = nextHeadCell.endCell();
  }

  return headCell ?? Cell.EMPTY;
}
