import { BluetoothLe } from '@capacitor-community/bluetooth-le';
import { BluetoothRequired } from '@ledgerhq/errors';

export async function awaitsBleOn(): Promise<void> {
  await BluetoothLe.initialize();
  const isEnabled = await BluetoothLe.isEnabled();
  if (!isEnabled) {
    throw new BluetoothRequired('', {
      state: 'disable',
    });
  }
}
