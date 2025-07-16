import type { WindowMethodResponse, WindowMethods } from '../storages/capacitorStorage';
import type { IAirWindow } from '../types/air';

let nativeCallNumber = 0;

export const airAppCallWindow = <T extends keyof WindowMethods>(methodName: T, arg0?: any, arg1?: any) => {
  const airWindow = window as IAirWindow;
  const bridge = airWindow.airBridge;
  return new Promise<WindowMethodResponse<T> | undefined>((resolve, reject) => {
    nativeCallNumber++;
    const requestNumber = nativeCallNumber;
    bridge.nativeCallCallbacks[requestNumber] = (response) => {
      delete bridge.nativeCallCallbacks[requestNumber];
      if (!response.ok) reject(new Error());
      else resolve(response.result as WindowMethodResponse<T> | undefined);
    };
    if (airWindow.webkit) {
      airWindow.webkit?.messageHandlers.nativeCall.postMessage({
        requestNumber, methodName, arg0, arg1,
      });
    } else {
      airWindow.androidApp.nativeCall(
        requestNumber, methodName, arg0, arg1,
      );
    }
  });
};
