export const TOKEN_TRANSFER_TON_AMOUNT = '0.05';
export const TOKEN_TRANSFER_TON_FORWARD_AMOUNT = '0';

export enum JettonOpCode {
  transfer = 0xf8a7ea5,
  transferNotification = 0x7362d09c,
  internalTransfer = 0x178d4519,
  excesses = 0xd53276db,
  burn = 0x595f07bc,
  burnNotification = 0x7bdd97de,
}

export enum NftOpCode {
  transferOwnership = 0x5fcc3d14,
}

export const STAKE_COMMENT = 'd';
export const UNSTAKE_COMMENT = 'w';
