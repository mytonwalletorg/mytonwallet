import type { ApiTonWalletVersion } from '../chains/ton/types';
import type { ApiLedgerDriver } from './misc';

type ApiBaseWallet = {
  address: string;
  /** Misses for TON view wallets, that are not wallets or not initialized, and TRON view wallets */
  publicKey?: string;
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

export type ApiViewAccount = {
  type: 'view';
  ton?: ApiTonWallet;
  tron?: ApiTronWallet;
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

export type ApiAccountAny = ApiBip39Account | ApiTonAccount | ApiLedgerAccount | ApiViewAccount;
export type ApiAccountWithMnemonic = Extract<ApiAccountAny, { mnemonicEncrypted: string }>;
export type ApiAccountWithTon = ApiAccountAny & { ton: ApiTonWallet };
export type ApiAccountWithTron = (ApiBip39Account | ApiViewAccount) & { tron: ApiTronWallet };

export interface ApiDappMetadata {
  url: string;
  name: string;
  iconUrl: string;
  manifestUrl: string;
}

export interface ApiDapp extends ApiDappMetadata {
  connectedAt: number;
  isUrlEnsured?: boolean;
  sse?: ApiSseOptions;
}

export interface ApiSseOptions {
  clientId: string;
  appClientId: string;
  secretKey: string;
  lastOutputId: number;
}

export type ApiDappsState = Record<string, Record<string, ApiDapp>>;
