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
export function replaceCurrentDomainRenewalId(global: GlobalState, replaceMap: Map<string, string>) {
  const newTxId = global.currentDomainRenewal.txId && replaceMap.get(global.currentDomainRenewal.txId);
  if (newTxId !== undefined) {
    global = updateCurrentDomainRenewal(global, { txId: newTxId });
  }
  return global;
}

/** replaceMap: keys - old (removed) activity ids, value - new (added) activity ids */
export function replaceCurrentDomainLinkingId(global: GlobalState, replaceMap: Map<string, string>) {
  const newTxId = global.currentDomainLinking.txId && replaceMap.get(global.currentDomainLinking.txId);
  if (newTxId !== undefined) {
    global = updateCurrentDomainLinking(global, { txId: newTxId });
  }
  return global;
}
