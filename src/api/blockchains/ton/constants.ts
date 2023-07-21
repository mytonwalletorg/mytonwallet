import type { ApiParsedPayload } from '../../types';

export const TOKEN_TRANSFER_TON_AMOUNT = 50000000n; // 0.05 TON
export const TOKEN_TRANSFER_TON_FORWARD_AMOUNT = 1n; // 0.000000001 TON

export const STAKE_COMMENT = 'd';
export const UNSTAKE_COMMENT = 'w';

export const ATTEMPTS = 5;

export const DEFAULT_DECIMALS = 9;

export const LEDGER_SUPPORTED_PAYLOADS: ApiParsedPayload['type'][] = [
  'transfer-nft',
  'transfer-tokens',
  'comment',
];

export enum OpCode {
  Comment = 0,
  Encrypted = 0x2167da4b,
}

export enum JettonOpCode {
  Transfer = 0xf8a7ea5,
  TransferNotification = 0x7362d09c,
  InternalTransfer = 0x178d4519,
  Excesses = 0xd53276db,
  Burn = 0x595f07bc,
  BurnNotification = 0x7bdd97de,
}

export enum NftOpCode {
  TransferOwnership = 0x5fcc3d14,
}
