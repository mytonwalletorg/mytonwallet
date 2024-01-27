import type { ApiParsedPayload } from '../../types';
import type { ContractInfo, ContractName } from './types';

export const TOKEN_TRANSFER_TON_AMOUNT = 50000000n; // 0.05 TON
export const TOKEN_TRANSFER_TON_FORWARD_AMOUNT = 1n; // 0.000000001 TON

export const STAKE_COMMENT = 'd';
export const UNSTAKE_COMMENT = 'w';

export const ATTEMPTS = 5;

export const DEFAULT_DECIMALS = 9;
export const DEFAULT_IS_BOUNCEABLE = false;

// Fee may change, so we add 5% for more reliability. This is only safe for low-fee blockchains such as TON.
export const FEE_FACTOR = 1.05;

export const LEDGER_SUPPORTED_PAYLOADS: ApiParsedPayload['type'][] = [
  'nft:transfer',
  'tokens:transfer',
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

export enum LiquidStakingOpCode {
  // Pool
  RequestLoan = 0xe642c965,
  LoanRepayment = 0xdfdca27b,
  Deposit = 0x47d54391,
  Withdraw = 0x319B0CDC,
  Withdrawal = 0x0a77535c,
  DeployController = 0xb27edcad,
  Touch = 0x4bc7c2df,
  Donate = 0x73affe21,
  // NFT
  DistributedAsset = 0xdb3b8abd,
}

export enum ContractType {
  Wallet = 'wallet',
  Staking = 'staking',
}

export const KnownContracts: Record<ContractName, ContractInfo> = {
  simpleR1: {
    name: 'simpleR1',
    hash: '3232dc55b02b3d2a9485adc151cf29c50b94c374d3571cb59390d761b87af8bd',
    type: ContractType.Wallet,
  },
  simpleR2: {
    name: 'simpleR2',
    hash: '672ce2b01d2fd487a5e0528611e7e4fc11867148cc13ff772bd773b72fb368df',
    type: ContractType.Wallet,
  },
  simpleR3: {
    name: 'simpleR3',
    hash: 'd95417233f66ae218317f533630cbbddc677d6d893d5722be6947c8fad8e9d52',
    type: ContractType.Wallet,
  },
  v2R1: {
    name: 'v2R1',
    hash: 'fb3bd539b7e50166f1cfdc0bbd298b1c88f6b261fe5ee61343ea47ab4b256029',
    type: ContractType.Wallet,
  },
  v2R2: {
    name: 'v2R2',
    hash: 'b584b6106753b7f34709df505be603e463a44ff6a85adf7fec4e26453c325983',
    type: ContractType.Wallet,
  },
  v3R1: {
    name: 'v3R1',
    hash: '11d123ed5c2055128e75a9ef4cf1e837e6d14a9c079c39939885c78dc13626e6',
    type: ContractType.Wallet,
  },
  v3R2: {
    name: 'v3R2',
    hash: 'df7bf014ee7ac0c38da19ef1b7fa054e2cc7a4513df1f1aa295109cf3606ac14',
    type: ContractType.Wallet,
  },
  v4R1: {
    name: 'v4R1',
    hash: '1bc0dfa40956c911616f8a5db09ecc217601bae48d7d3f9311562c5afcb66dcf',
    type: ContractType.Wallet,
  },
  v4R2: {
    name: 'v4R2',
    hash: '5659ce2300f4a09a37b0bdee41246ded52474f032c1d6ffce0d7d31b18b7b2b1',
    type: ContractType.Wallet,
  },
  highloadV2: {
    name: 'highloadV2',
    hash: 'fcd7d1f3b3847f0b9bd44bc64a2256c03450979dd1646a24fbc874b075392d6e',
    type: ContractType.Wallet,
  },
  nominatorPool: {
    name: 'nominatorPool',
    hash: 'bffbc2310c6c535fe7271667fd3352a1151d097905c052701c5c98bf45487f08',
    type: ContractType.Staking,
  },
};
