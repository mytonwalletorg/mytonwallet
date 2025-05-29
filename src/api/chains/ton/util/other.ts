import { sha256_sync } from '@ton/crypto';

export function sha256BigInt(s: string): bigint {
  return BigInt(`0x${sha256_sync(s).toString('hex')}`);
}
