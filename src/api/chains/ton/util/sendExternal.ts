import type { Cell } from '@ton/core';
import { beginCell, external, storeMessage } from '@ton/core';

import type { GaslessType } from '../transactions';
import type { TonClient } from './TonClient';
import type { TonWallet } from './tonCore';

import { dieselSendBoc } from './diesel';
import { dieselW5SendRequest } from './w5diesel';

export async function sendExternal(
  client: TonClient,
  wallet: TonWallet,
  message: Cell,
  gaslessType?: GaslessType,
) {
  const {
    address,
    init,
  } = wallet;

  let neededInit: { data: Cell; code: Cell } | undefined;
  if (init && !await client.isContractDeployed(address)) {
    neededInit = init;
  }

  const ext = external({
    to: address,
    init: neededInit ? {
      code: neededInit.code,
      data: neededInit.data,
    } : undefined,
    body: message,
  });

  const cell = beginCell()
    .store(storeMessage(ext))
    .endCell();

  const isW5Gasless = gaslessType === 'w5';

  const msgHash = cell.hash().toString('base64');
  const bodyMessageHash = message.hash().toString('base64');
  const boc = cell.toBoc().toString('base64');

  let paymentLink;
  if (isW5Gasless) {
    const result = await dieselW5SendRequest(boc);
    paymentLink = result.paymentLink;
  } else if (gaslessType === 'diesel') {
    const result = await dieselSendBoc(boc);
    paymentLink = result.paymentLink;
  } else {
    await client.sendFile(boc);
  }

  return {
    boc,
    msgHash: isW5Gasless ? bodyMessageHash : msgHash,
    paymentLink,
  };
}
