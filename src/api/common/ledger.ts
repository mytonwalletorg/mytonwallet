import Transport from '@ledgerhq/hw-transport';

import { IS_AIR_APP } from '../../config';
import { callWindow } from '../../util/windowProvider/connector';

/**
 * A Ledger's Transport implementation that passes the data to the actual transfer object in the main browser thread
 * (src/util/ledger/index.ts) via postMessage (because actual Ledger transports don't work in worker threads).
 */
export class WindowTransport extends Transport {
  async exchange(apdu: Buffer) {
    if (IS_AIR_APP) {
      // @ts-ignore
      const hexResult: string = await callWindow('exchangeWithLedger', Buffer.from(apdu).toString('hex'));
      return Buffer.from(hexResult, 'hex');
    } else {
      const response = await callWindow('exchangeWithLedger', apdu.toString('base64'));
      return Buffer.from(response, 'base64');
    }
  }
}
