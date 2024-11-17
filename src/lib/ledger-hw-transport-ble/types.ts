import type { BleDevice } from '@capacitor-community/bluetooth-le';

export type Device = BleDevice;
export type Characteristic = any;

export type ReconnectionConfig = {
  pairingThreshold: number;
  delayAfterFirstPairing: number;
};
