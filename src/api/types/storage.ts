import type { ApiTonWalletVersion } from '../chains/ton/types';
import type { ApiLedgerDriver } from './misc';

type ApiBaseWallet = {
  address: string;
  publicKey: string;
  index: number;
};

export type ApiBip39Account = {
  type: 'bip39';
  mnemonicEncrypted: string;
  tron: ApiTronWallet;
  ton: ApiTonWallet;
};

export type ApiTonAccount = {
  type: 'ton';
  mnemonicEncrypted: string;
  ton: ApiTonWallet;
};

export type ApiLedgerAccount = {
  type: 'ledger';
  ton: ApiTonWallet;
  driver: ApiLedgerDriver;
  deviceId?: string;
  deviceName?: string;
};

export type ApiTonWallet = ApiBaseWallet & {
  type: 'ton';
  version: ApiTonWalletVersion;
  isInitialized?: boolean;
  authToken?: string;
};

export type ApiTronWallet = ApiBaseWallet & {
  type: 'tron';
};

export type ApiAccountAny = ApiBip39Account | ApiTonAccount | ApiLedgerAccount;
export type ApiAccountWithMnemonic = ApiBip39Account | ApiTonAccount;
export type ApiAccountWithTon = ApiTonAccount | ApiLedgerAccount;
export type ApiAccountWithTron = ApiBip39Account;
export type ApiWalletAny = ApiTonWallet | ApiTronWallet;

export interface ApiDappMetadata {
  origin: string;
  url: string;
  name: string;
  iconUrl: string;
  manifestUrl: string;
}

export interface ApiDapp extends ApiDappMetadata {
  connectedAt: number;
  sse?: ApiSseOptions;
}

export interface ApiSseOptions {
  clientId: string;
  appClientId: string;
  secretKey: string;
  lastOutputId: number;
}

export type ApiDappsState = Record<string, Record<string, ApiDapp>>;
