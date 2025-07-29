import type { BiometricRequestAccessParams } from '@twa-dev/types';

import { APP_NAME } from '../../config';
import { mapValues } from '../iteratees';
import safeExec from '../safeExec';
import { getTelegramApp } from '../telegram';

function requestBiometricAccess(options: BiometricRequestAccessParams) {
  return new Promise((resolve, reject) => {
    getTelegramApp()!.BiometricManager.requestAccess(options, (accessGranted) => {
      if (accessGranted) {
        resolve(accessGranted);
      } else {
        reject(new Error('Access denied'));
      }
    });
  });
}

export async function setBiometricCredentials(password: string) {
  const biometricManager = getTelegramApp()!.BiometricManager;

  if (!biometricManager.isAccessGranted) {
    const isAccessGranted = await requestBiometricAccess({ reason: APP_NAME });
    if (!isAccessGranted) {
      throw new Error('Access to biometric data has not been granted');
    }
  }

  return new Promise((resolve, reject) => {
    biometricManager.updateBiometricToken(password, (updated) => {
      if (updated) {
        resolve(password);
      } else {
        reject(new Error('Failed to update or save the biometric token'));
      }
    });
  });
}

export async function verifyIdentity() {
  const biometricManager = getTelegramApp()!.BiometricManager;

  if (!biometricManager.isAccessGranted) {
    const isAccessGranted = await requestBiometricAccess({ reason: APP_NAME });
    if (!isAccessGranted) {
      throw new Error('Biometric access was denied. Please grant access to proceed.');
    }
  }

  return new Promise<{ success: boolean; token: string }>((resolve, reject) => {
    biometricManager.authenticate(
      { reason: '' },
      // @ts-ignore Wrong type signature https://github.com/twa-dev/types/pull/12
      (success: boolean, token: string) => {
        if (success) {
          resolve({ success, token });
        } else {
          reject(new Error('Biometric authentication failed. Please try again.'));
        }
      },
    );
  });
}

export function signCustomData(
  initDataFields: AnyLiteral,
  payload: string,
  options?: {
    shouldSignHash?: boolean;
    isPayloadBinary?: boolean;
  },
): Promise<{ result: string; resultUnsafe: AnyLiteral }> {
  const app = getTelegramApp()!;

  return new Promise((resolve, reject) => {
    (app as any).invokeCustomMethod('prepareSignedPayload', {
      init_data: app.initData,
      init_data_sign_fields: initDataFields,
      payload,
      ...(options?.shouldSignHash && { sign_sha256: true }),
      ...(options?.isPayloadBinary && { is_payload_binary: true }),
    }, (err: Error, result: string) => {
      if (result) {
        resolve({
          result,
          resultUnsafe: parseResultUnsafe(result),
        });
      } else {
        reject(err || 'Unknown Error');
      }
    });
  });
}

function parseResultUnsafe(appData: string) {
  const resultUnsafe = (window.Telegram as any).Utils.urlParseQueryString(appData);

  return mapValues(resultUnsafe, (value: string) => {
    if ((value.startsWith('{') && value.endsWith('}')) || (value.startsWith('[') && value.endsWith(']'))) {
      return safeExec(() => JSON.parse(value));
    }

    return value;
  });
}
