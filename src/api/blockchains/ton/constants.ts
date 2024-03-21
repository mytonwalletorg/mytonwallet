import type { ApiParsedPayload, ApiWalletVersion } from '../../types';
import type { ContractInfo, ContractName } from './types';

export const TOKEN_TRANSFER_TON_AMOUNT = 100000000n; // 0.1 TON
export const TOKEN_TRANSFER_TON_FORWARD_AMOUNT = 1n; // 0.000000001 TON

export const STAKE_COMMENT = 'd';
export const UNSTAKE_COMMENT = 'w';

export const ATTEMPTS = 5;

export const DEFAULT_DECIMALS = 9;
export const DEFAULT_IS_BOUNCEABLE = true;
export const WALLET_IS_BOUNCEABLE = false;

// Fee may change, so we add 5% for more reliability. This is only safe for low-fee blockchains such as TON.
export const FEE_FACTOR = 1.05;

export const LEDGER_SUPPORTED_PAYLOADS: ApiParsedPayload['type'][] = [
  'nft:transfer',
  'tokens:transfer',
  'comment',
];

export const ALL_WALLET_VERSIONS: ApiWalletVersion[] = [
  'simpleR1', 'simpleR2', 'simpleR3', 'v2R1', 'v2R2', 'v3R1', 'v3R2', 'v4R2',
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
    isLedgerAllowed: true,
  },
  simpleR2: {
    name: 'simpleR2',
    hash: '672ce2b01d2fd487a5e0528611e7e4fc11867148cc13ff772bd773b72fb368df',
    type: ContractType.Wallet,
    isLedgerAllowed: true,
  },
  simpleR3: {
    name: 'simpleR3',
    hash: 'd95417233f66ae218317f533630cbbddc677d6d893d5722be6947c8fad8e9d52',
    type: ContractType.Wallet,
    isLedgerAllowed: true,
  },
  v2R1: {
    name: 'v2R1',
    hash: 'fb3bd539b7e50166f1cfdc0bbd298b1c88f6b261fe5ee61343ea47ab4b256029',
    type: ContractType.Wallet,
    isLedgerAllowed: true,
  },
  v2R2: {
    name: 'v2R2',
    hash: 'b584b6106753b7f34709df505be603e463a44ff6a85adf7fec4e26453c325983',
    type: ContractType.Wallet,
    isLedgerAllowed: true,
  },
  v3R1: {
    name: 'v3R1',
    hash: '11d123ed5c2055128e75a9ef4cf1e837e6d14a9c079c39939885c78dc13626e6',
    type: ContractType.Wallet,
    isLedgerAllowed: true,
  },
  v3R2: {
    name: 'v3R2',
    hash: 'df7bf014ee7ac0c38da19ef1b7fa054e2cc7a4513df1f1aa295109cf3606ac14',
    type: ContractType.Wallet,
    isLedgerAllowed: true,
  },
  v4R1: {
    name: 'v4R1',
    hash: '1bc0dfa40956c911616f8a5db09ecc217601bae48d7d3f9311562c5afcb66dcf',
    type: ContractType.Wallet,
    isLedgerAllowed: true,
  },
  v4R2: {
    name: 'v4R2',
    hash: '5659ce2300f4a09a37b0bdee41246ded52474f032c1d6ffce0d7d31b18b7b2b1',
    type: ContractType.Wallet,
    isLedgerAllowed: true,
  },
  highloadV2: {
    name: 'highloadV2',
    hash: 'fcd7d1f3b3847f0b9bd44bc64a2256c03450979dd1646a24fbc874b075392d6e',
    type: ContractType.Wallet,
    isLedgerAllowed: true,
  },
  nominatorPool: {
    name: 'nominatorPool',
    hash: 'bffbc2310c6c535fe7271667fd3352a1151d097905c052701c5c98bf45487f08',
    type: ContractType.Staking,
    isLedgerAllowed: true,
  },
  multisig: {
    name: 'multisig',
    hash: '45d890485cdd6b152bcbbe3fb2e16d2df82f6da840440a5b9f34ea13cb0b92d2',
    type: ContractType.Wallet,
    isLedgerAllowed: true,
  },
  multisigV2: {
    name: 'multisigV2',
    hash: 'eb1323c5544d5bf26248dc427d108d722d5c2922dd97dd0bdf903c4cea73ca97',
    type: ContractType.Wallet,
    isLedgerAllowed: true,
  },
  vesting: {
    name: 'vesting',
    hash: '69dc931958f7aa203c4a7bfcf263d25d2d828d573184b542a65dd55c8398ad83',
    type: ContractType.Wallet,
    isLedgerAllowed: true,
  },
  dedustPool: {
    name: 'dedustPool',
    hash: 'af6a1790ccd322e9b996733cce5618901a99d76c4c5a219309deef9b0910b238',
    isSwapAllowed: true,
  },
  dedustVaultNative: {
    name: 'dedustVaultNative',
    hash: '8ecbfbe7642ebceec39712a4b3e7b3d1ffc2cfbb1b712fbf1f27f1051afb5220',
    isSwapAllowed: true,
  },
  dedustVaultNative2: {
    name: 'dedustVaultNative2',
    hash: '546ea179831fd6bda3d7515f07a5322486ae4ea4685125e6034758b8cca5b917',
    isSwapAllowed: true,
  },
  dedustVaultJetton: {
    name: 'dedustVaultJetton',
    hash: '54f0c2a249ea3c5fc844c48e2586d8a72e6fc188a1ccaec609fac58248b8c8e3',
    isSwapAllowed: true,
  },
  stonPtonWallet: {
    name: 'stonPtonWallet',
    hash: '6ccbf71a3ed9c7355f84a698a44a7406574bfb8aa34d4bbd86ab75ee9c994880',
    isSwapAllowed: true,
  },
  stonRouter: {
    name: 'stonRouter',
    hash: '14ce618a0e9a94adc99fa6e975219ddd675425b30dfa9728f98714c8dc55f9da',
    isSwapAllowed: true,
  },
  megatonWtonMaster: {
    name: 'megatonWtonMaster',
    hash: '4c9790d808ea4470614e021f76c40529efe2fbce8138da4284a29b5f1943ef19',
    isSwapAllowed: true,
  },
  megatonRouter: {
    name: 'megatonRouter',
    hash: '5d5f0e3ed9602d1ba96006ead98cb5e9b53f49ce4a5cf675e06e4d440b7d267c',
    isSwapAllowed: true,
  },
};
