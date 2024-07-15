import type { Cell } from '@ton/core';
import { beginCell, external, storeMessage } from '@ton/core';

import type { TonClient } from './TonClient';
import type { TonWallet } from './tonCore';

import { dieselSendBoc } from './diesel';

export async function sendExternal(
  client: TonClient,
  wallet: TonWallet,
  message: Cell,
  withDiesel?: boolean,
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

  const msgHash = cell.hash().toString('base64');
  const boc = cell.toBoc().toString('base64');

  if (withDiesel) {
    await dieselSendBoc(boc);
  } else {
    await client.sendFile(boc);
  }

  return {
    boc,
    msgHash,
  };
}
