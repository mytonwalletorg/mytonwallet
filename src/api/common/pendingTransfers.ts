import type { ApiNetwork } from '../types';

import Deferred from '../../util/Deferred';
import generateUniqueId from '../../util/generateUniqueId';

const byId: Record<string, Deferred> = {};
const byAddress: Record<string, Deferred> = {};

export async function waitAndCreatePendingTransfer(network: ApiNetwork, address: string) {
  const key = `${network}:${address}`;
  const prevPending = byAddress[key];

  const id = generateUniqueId();
  const pendingTransfer = new Deferred();
  byAddress[key] = pendingTransfer;
  byId[id] = pendingTransfer;

  if (prevPending) {
    await prevPending.promise;
  }

  return { id, pendingTransfer };
}

export function getPendingTransfer(id: string): Deferred | undefined {
  return byId[id];
}
