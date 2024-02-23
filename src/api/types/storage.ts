import type { ApiLedgerDriver, ApiWalletVersion } from './misc';

export interface ApiAccount {
  address: string;
  publicKey: string;
  version: ApiWalletVersion;
  ledger?: {
    index: number;
    driver: ApiLedgerDriver;
    deviceId?: string;
    deviceName?: string;
  };
  lastFinishedSwapTimestamp?: number;
  authToken?: string;
  isInitialized?: boolean;
}

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
