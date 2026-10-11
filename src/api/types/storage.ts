import type { ApiTonWalletVersion } from '../chains/ton/types';
import type { ApiChain, ApiDerivation } from './misc';

type ApiBaseWallet = {
  address: string;
  /** Misses in view wallets. Though, it is presented in TON view wallets that are initialized wallet contracts. */
  publicKey?: string;
  index: number;
  // Omitted in TON-only seed with no derivation logic and in View-accounts
  derivation?: ApiDerivation;
};

export type ApiTonWallet = ApiBaseWallet & {
  version: ApiTonWalletVersion;
  isInitialized?: boolean;
  authToken?: string;
};

export type ApiEVMWallet = ApiBaseWallet;

/** A helper type that converts the chain names to the corresponding wallet types */
export type ApiWalletByChain = {
  ton: ApiTonWallet;
  bnb: ApiEVMWallet;
};

type ApiBaseAccount = {
  byChain: {
    [K in ApiChain]?: ApiWalletByChain[K];
  };
};

/** Also accounts based on a private key */
export type ApiBip39Account = ApiBaseAccount & {
  type: 'bip39';
};

export type ApiTonAccount = ApiBaseAccount & {
  type: 'ton';
};

export type ApiViewAccount = ApiBaseAccount & {
  type: 'view';
};

export type ApiAccountAny = ApiBip39Account | ApiTonAccount | ApiViewAccount;
export type ApiAccountWithMnemonic = ApiBip39Account | ApiTonAccount;
export type ApiAccountWithChain<T extends ApiChain> = ApiAccountAny & { byChain: Record<T, ApiWalletByChain[T]> };

export interface ApiSseOptions {
  clientId: string;
  appClientId: string;
  secretKey: string;
  lastOutputId: number;
}
