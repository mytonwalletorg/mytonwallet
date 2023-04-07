import { Address, Cell } from 'ton-core';

import { base64ToString } from '../../../common/utils';
import { DEBUG } from '../../../../config';

const IPFS_EXPLORER_BASE_URL: string = 'https://ipfs.io/ipfs/';

enum JettonOpCode {
  transfer = 0xf8a7ea5,
  transferNotification = 0x7362d09c,
  internalTransfer = 0x178d4519,
  excesses = 0xd53276db,
  burn = 0x595f07bc,
  burnNotification = 0x7bdd97de,
}

export function parseJettonWalletMsgBody(body?: string) {
  if (!body) return undefined;

  try {
    let slice = Cell.fromBase64(body).beginParse();
    const opCode = slice.loadUint(32);

    if (opCode === JettonOpCode.transfer || opCode === JettonOpCode.internalTransfer) {
      const queryId = slice.loadUint(64);
      const jettonAmount = slice.loadCoins();
      const address = slice.loadAddress();
      const responseAddress = slice.loadAddress();
      if (opCode === JettonOpCode.transfer) {
        slice.loadBit();
      }
      const forwardAmount = slice.loadCoins();
      const isSeparateCell = slice.loadBit();

      let forwardComment: string | undefined;
      if (isSeparateCell && slice.remainingRefs) {
        slice = slice.loadRef().beginParse();
      }
      if (slice.remainingBits > 32 && slice.loadUint(32) === 0) {
        forwardComment = slice.loadStringTail();
      }

      return {
        operation: JettonOpCode[opCode],
        queryId,
        jettonAmount,
        responseAddress,
        address: toBounceableAddress(address),
        forwardAmount,
        forwardComment,
      };
    }
  } catch (err) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.error('[parseJettonWalletMsgBody]', err);
    }
  }

  return undefined;
}

function toBounceableAddress(address: Address) {
  return address.toString({ urlSafe: true, bounceable: true });
}

export function fixIpfsUrl(url: string) {
  return url.replace('ipfs://', IPFS_EXPLORER_BASE_URL);
}

export function fixBase64ImageData(data: string) {
  const decodedData = base64ToString(data);
  if (decodedData.includes('<svg')) {
    return `data:image/svg+xml;base64,${data}`;
  }
  return `data:image/png;base64,${data}`;
}
