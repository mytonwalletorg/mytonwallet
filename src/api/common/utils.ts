import { STAKING_POOLS } from '../../config';

export function sha256(bytes: Uint8Array) {
  return crypto.subtle.digest('SHA-256', bytes);
}

export function bytesToHex(bytes: Uint8Array) {
  return Buffer.from(bytes).toString('hex');
}

export function hexToBytes(hex: string) {
  return Uint8Array.from(Buffer.from(hex, 'hex'));
}

export function bytesToBase64(bytes: Uint8Array) {
  return Buffer.from(bytes).toString('base64');
}

export function base64ToBytes(base64: string) {
  return Uint8Array.from(Buffer.from(base64, 'base64'));
}

export function base64ToString(base64: string) {
  return Buffer.from(base64, 'base64').toString('utf-8');
}

export function isKnownStakingPool(address: string) {
  return STAKING_POOLS.some((poolPart) => address.endsWith(poolPart));
}
