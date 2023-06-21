import type { ApiLedgerDriver, ApiWalletVersion } from '../../api/types';

export interface LedgerWalletInfo {
  index: number;
  address: string;
  publicKey: string;
  balance: string;
  version: ApiWalletVersion;

  driver: ApiLedgerDriver;
  deviceId?: string;
  deviceName?: string;
}
