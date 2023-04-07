export function cloneDeep<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export function stringifyTxId({ lt, hash }: { lt: string; hash: string }) {
  return `${lt}:${hash}`;
}
