import type { ApiTonWalletVersion } from '../../api/chains/ton/types';
import type { ApiLedgerDriver } from '../../api/types';

export interface LedgerWalletInfo {
  index: number;
  address: string;
  publicKey: string;
  balance: bigint;
  version: ApiTonWalletVersion;

  driver: ApiLedgerDriver;
  deviceId?: string;
  deviceName?: string;
}

export type LedgerTransport = 'usb' | 'bluetooth';
