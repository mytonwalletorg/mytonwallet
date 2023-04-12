import { Address, Cell } from 'ton-core';

import { base64ToString } from '../../../common/utils';
import { DEBUG } from '../../../../config';
import { JettonOpCode } from '../constants';

const IPFS_EXPLORER_BASE_URL: string = 'https://ipfs.io/ipfs/';

export function parseJettonWalletMsgBody(body?: string) {
  if (!body) return undefined;

  try {
    let slice = Cell.fromBase64(body).beginParse();
    const opCode = slice.loadUint(32);

    if (opCode === JettonOpCode.transfer || opCode === JettonOpCode.internalTransfer) {
      const queryId = slice.loadUint(64);
      const jettonAmount = slice.loadCoins();
      const address = slice.loadAddress();
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

export function toBounceableAddress(address: Address) {
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
