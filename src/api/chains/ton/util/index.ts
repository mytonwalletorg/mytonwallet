import { bigintRandom, bigintReviver } from '../../../../util/bigint';

export function cloneDeep<T>(value: T): T {
  return JSON.parse(JSON.stringify(value), bigintReviver);
}

export function stringifyTxId({ lt, hash }: { lt: number | string; hash: string }) {
  return `${lt}:${hash}`;
}

export function parseTxId(txId: string): { lt: number; hash: string } {
  const [lt, hash] = txId.split(':');
  return { lt: Number(lt), hash };
}

export function generateQueryId() {
  return bigintRandom(8);
}
