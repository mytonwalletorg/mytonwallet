import { bigintReviver } from '../../../../util/bigint';

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

export function buildTokenSlug(minterAddress: string) {
  const addressPart = minterAddress.replace(/[^a-z\d]/gi, '').slice(0, 10);
  return `ton-${addressPart}`.toLowerCase();
}
