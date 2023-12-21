import TonWeb from 'tonweb';
import type { Cell as CellType } from 'tonweb/dist/types/boc/cell';

import type { ApiNetwork } from '../../types';

import { getTonWeb } from './util/tonweb';
import { bytesToBase64 } from '../../common/utils';

const { Cell } = TonWeb.boc;

export async function packPayloadToBoc(payload: string | Uint8Array | CellType) {
  let payloadCell = new Cell();
  if (payload) {
    if (payload instanceof Cell) {
      payloadCell = payload;
    } else if (typeof payload === 'string') {
      if (payload.length > 0) {
        payloadCell.bits.writeUint(0, 32);
        payloadCell.bits.writeString(payload);
      }
    } else {
      payloadCell.bits.writeBytes(payload);
    }
  }
  return bytesToBase64(await payloadCell.toBoc());
}

export async function checkApiAvailability(network: ApiNetwork) {
  try {
    await getTonWeb(network).provider.getMasterchainInfo();
    return true;
  } catch (err: any) {
    return false;
  }
}
