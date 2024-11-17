import { BleClient } from '@capacitor-community/bluetooth-le';
import type { Subscription as TransportSubscription } from '@ledgerhq/hw-transport';
import { v4 as uuid } from 'uuid';
import type { BleDevice } from '@capacitor-community/bluetooth-le/dist/esm/definitions';

import { IS_CAPACITOR } from '../../config';
import BleTransport from '../../lib/ledger-hw-transport-ble/BleTransport';

interface ScannedDevice {
  identifier: string;
  device: BleDevice;
}

export interface LedgerConnection {
  device: BleDevice;
  bleTransport: BleTransport;
}

let listeningSubscription: TransportSubscription | undefined;

let scannedDevices: ScannedDevice[] = [];
let pairedDevice: LedgerConnection | undefined;
let onLedgerConnected: ((connection: LedgerConnection) => void) | undefined;

function isConnecting() {
  return !!listeningSubscription;
}

function scannedDeviceIsValidYet(scannedDevice: ScannedDevice): boolean {
  if (!scannedDevices.find((it) => it.identifier === scannedDevice.identifier)) {
    // List is already cleared
    return false;
  }

  // A device is already paired
  return !pairedDevice;
}

async function tryConnectingLedgerDevice(scannedDevice: ScannedDevice) {
  try {
    // Check if stopped before retry
    if (!scannedDeviceIsValidYet(scannedDevice)) return;

    const bleTransport = await BleTransport.open(scannedDevice.device);
    // Check if stopped before connection establish
    if (!scannedDeviceIsValidYet(scannedDevice)) return;

    const ledgerConnection = {
      device: scannedDevice.device,
      bleTransport,
    };
    pairedDevice = ledgerConnection;

    bleTransport.disconnectCallback = () => {
      pairedDevice = undefined;
      if (isConnecting()) {
        stop();
        start();
      }
    };

    setTimeout(() => {
      // Make sure not disconnected yet
      if (pairedDevice?.device.deviceId === ledgerConnection.device.deviceId) {
        onLedgerConnected?.(ledgerConnection);
        stop();
      } else if (isConnecting()) {
        // Unexpectedly, disconnected before calling the callback, restart!
        pairedDevice = undefined;
        stop();
        void start();
      }
    }, 1000);
  } catch (error) {
    setTimeout(() => {
      tryConnectingLedgerDevice(scannedDevice);
    }, 10000);
  }
}

async function isSupported() {
  if (!IS_CAPACITOR) return false;

  try {
    await BleClient.initialize({
      androidNeverForLocation: true,
    });
    await BleClient.requestEnable();
  } catch (error) { /* empty */ }

  return BleClient.isEnabled();
}

function start() {
  listeningSubscription = BleTransport.listen({
    next: (event: { type: string; device?: BleDevice }) => {
      switch (event.type) {
        case 'add':
          if (event.device) {
            if (!event.device.name) return;
            if (scannedDevices.find((it) => it.device.deviceId === event.device?.deviceId)) return;
            const scannedDevice = { identifier: uuid(), device: event.device };
            scannedDevices.push(scannedDevice);
            void tryConnectingLedgerDevice(scannedDevice);
          }
          break;
      }
    },
    error: () => {
      stop();
    },
    complete: () => {
      stop();
    },
  });
}

function stop() {
  scannedDevices = [];
  listeningSubscription?.unsubscribe();
  listeningSubscription = undefined;
}

function connect(): Promise<LedgerConnection> {
  return new Promise((resolve) => {
    onLedgerConnected = resolve;
    if (pairedDevice) {
      onLedgerConnected(pairedDevice);
      return;
    }

    if (isConnecting()) return;
    start();
  });
}

export const BleConnector = {
  isSupported,
  connect,
  stop,
};
