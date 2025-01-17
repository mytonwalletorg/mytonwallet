import { NativeBiometric } from '@capgo/capacitor-native-biometric';

import type { AuthConfig } from './types';
import type { CredentialCreationResult } from './webAuthn';

import { APP_NAME, NATIVE_BIOMETRICS_SERVER, NATIVE_BIOMETRICS_USERNAME } from '../../config';
import { logDebugError } from '../logs';
import { randomBytes } from '../random';
import webAuthn from './webAuthn';

const CREDENTIAL_SIZE = 32;

async function setupBiometrics({ credential }: { credential?: CredentialCreationResult }) {
  let result: { password: string; config: AuthConfig } | undefined;

  try {
    if (!credential) {
      const password = Buffer.from(randomBytes(CREDENTIAL_SIZE)).toString('hex');
      const encryptedPassword = await window.electron?.encryptPassword(password);
      if (!encryptedPassword) {
        return result;
      }

      result = {
        password,
        config: {
          kind: 'electron-safe-storage',
          encryptedPassword,
        },
      };
    } else {
      result = await webAuthn.verify(credential);
    }
  } catch (err) {
    logDebugError('setupBiometrics', err);
  }

  return result;
}

async function setupNativeBiometrics(password: string) {
  await NativeBiometric.setCredentials({
    username: NATIVE_BIOMETRICS_USERNAME,
    password,
    server: NATIVE_BIOMETRICS_SERVER,
  });

  return {
    password,
    config: {
      kind: 'native-biometrics',
    } as AuthConfig,
  };
}

function removeNativeBiometrics() {
  return NativeBiometric.deleteCredentials({
    server: NATIVE_BIOMETRICS_SERVER,
  });
}

async function getPassword(config: AuthConfig) {
  let password: string | undefined;

  try {
    if (config.kind === 'webauthn') {
      password = await webAuthn.getPassword(config);
    } else if (config.kind === 'electron-safe-storage') {
      password = await window.electron?.decryptPassword(config.encryptedPassword);
    } else if (config.kind === 'native-biometrics') {
      const isVerified = await NativeBiometric.verifyIdentity({
        title: APP_NAME,
        subtitle: '',
        isWeakAuthenticatorAllowed: true,
        maxAttempts: 1,
      })
        .then(() => true)
        .catch(() => false);

      if (!isVerified) return undefined;

      const credentials = await NativeBiometric.getCredentials({
        server: NATIVE_BIOMETRICS_SERVER,
      });
      password = credentials.password;
    } else {
      throw new Error('Unexpected auth kind');
    }
  } catch (err) {
    logDebugError('submitTransferPassword', err);
  }

  return password;
}

export default {
  setupBiometrics,
  setupNativeBiometrics,
  removeNativeBiometrics,
  getPassword,
  webAuthn,
};
