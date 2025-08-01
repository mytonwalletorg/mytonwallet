import type { GlobalState } from '../types';

export function updateCurrentDomainRenewal(
  global: GlobalState,
  update: Partial<GlobalState['currentDomainRenewal']>,
): GlobalState {
  return {
    ...global,
    currentDomainRenewal: {
      ...global.currentDomainRenewal,
      ...update,
    },
  };
}

export function updateCurrentDomainLinking(
  global: GlobalState,
  update: Partial<GlobalState['currentDomainLinking']>,
): GlobalState {
  return {
    ...global,
    currentDomainLinking: {
      ...global.currentDomainLinking,
      ...update,
    },
  };
}

/** replaceMap: keys - old (removed) activity ids, value - new (added) activity ids */
export function replaceCurrentDomainRenewalId(global: GlobalState, replaceMap: Record<string, string>) {
  const oldTxId = global.currentDomainRenewal.txId;
  const newTxId = oldTxId && replaceMap[oldTxId];
  if (newTxId !== oldTxId) {
    global = updateCurrentDomainRenewal(global, { txId: newTxId });
  }
  return global;
}

/** replaceMap: keys - old (removed) activity ids, value - new (added) activity ids */
export function replaceCurrentDomainLinkingId(global: GlobalState, replaceMap: Record<string, string>) {
  const oldTxId = global.currentDomainLinking.txId;
  const newTxId = oldTxId && replaceMap[oldTxId];
  if (newTxId !== oldTxId) {
    global = updateCurrentDomainLinking(global, { txId: newTxId });
  }
  return global;
}
