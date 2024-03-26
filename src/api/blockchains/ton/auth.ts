import * as tonWebMnemonic from 'tonweb-mnemonic';
import nacl from 'tweetnacl';

import { ApiCommonError } from '../../types';

import { logDebugError } from '../../../util/logs';
import { getAccountValue, setAccountValue } from '../../common/accounts';
import {
  base64ToBytes, bytesToBase64, bytesToHex, hexToBytes,
} from '../../common/utils';

const PBKDF2_IMPORT_KEY_ARGS = [
  { name: 'PBKDF2' },
  false,
  ['deriveBits', 'deriveKey'],
] as const;

const PBKDF2_DERIVE_KEY_ARGS = {
  name: 'PBKDF2',
  iterations: 100000, // Higher is more secure but slower
  hash: 'SHA-256',
};

const PBKDF2_DERIVE_KEY_TYPE = { name: 'AES-GCM', length: 256 };

export function generateMnemonic() {
  return tonWebMnemonic.generateMnemonic();
}

export function validateMnemonic(mnemonic: string[]) {
  return tonWebMnemonic.validateMnemonic(mnemonic);
}

export async function mnemonicToSeed(mnemonic: string[]) {
  const keyPair = await tonWebMnemonic.mnemonicToKeyPair(mnemonic);
  return bytesToBase64(keyPair.secretKey.slice(0, 32));
}

export function seedToKeyPair(seed: string) {
  return nacl.sign.keyPair.fromSeed(base64ToBytes(seed));
}

export async function encryptMnemonic(mnemonic: string[], password: string) {
  const plaintext = mnemonic.join(',');
  const salt = crypto.getRandomValues(new Uint8Array(16)); // generate a 128-bit salt
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    ...PBKDF2_IMPORT_KEY_ARGS,
  );
  const key = await crypto.subtle.deriveKey(
    {
      salt,
      ...PBKDF2_DERIVE_KEY_ARGS,
    },
    keyMaterial,
    PBKDF2_DERIVE_KEY_TYPE,
    false,
    ['encrypt'],
  );
  const iv = crypto.getRandomValues(new Uint8Array(12)); // get 96-bit random iv
  const ptUint8 = new TextEncoder().encode(plaintext); // encode plaintext as UTF-8
  const ctBuffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, ptUint8); // encrypt plaintext using key
  const ctArray = Array.from(new Uint8Array(ctBuffer)); // ciphertext as byte array
  const ctBase64 = btoa(String.fromCharCode(...ctArray)); // encode ciphertext as base64
  const ivHex = Array.from(iv).map((b) => (`00${b.toString(16)}`).slice(-2)).join(''); // iv as hex string
  const saltHex = Array.from(salt).map((b) => (`00${b.toString(16)}`).slice(-2)).join(''); // salt as hex string

  return `${saltHex}:${ivHex}:${ctBase64}`;
}

export async function decryptMnemonic(encrypted: string, password: string) {
  if (!encrypted.includes(':')) {
    return decryptMnemonicLegacy(encrypted, password);
  }

  const [saltHex, ivHex, encryptedData] = encrypted.split(':');
  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
  const iv = new Uint8Array(ivHex.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    ...PBKDF2_IMPORT_KEY_ARGS,
  );
  const key = await crypto.subtle.deriveKey(
    { salt, ...PBKDF2_DERIVE_KEY_ARGS },
    keyMaterial,
    PBKDF2_DERIVE_KEY_TYPE,
    false,
    ['decrypt'],
  );
  const ctStr = atob(encryptedData); // decode base64 ciphertext
  const ctUint8 = new Uint8Array(ctStr.match(/[\s\S]/g)!.map((ch) => ch.charCodeAt(0))); // ciphertext as Uint8Array
  const plainBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ctUint8); // decrypt ciphertext using key
  const plaintext = new TextDecoder().decode(plainBuffer); // decode password from UTF-8

  return plaintext.split(',');
}

async function decryptMnemonicLegacy(encrypted: string, password: string) {
  const pwUtf8 = new TextEncoder().encode(password); // encode password as UTF-8
  const pwHash = await crypto.subtle.digest('SHA-256', pwUtf8); // hash the password
  const iv = encrypted.slice(0, 24).match(/.{2}/g)!.map((byte) => parseInt(byte, 16)); // get iv from ciphertext
  const alg = { name: 'AES-GCM', iv: new Uint8Array(iv) }; // specify algorithm to use
  const key = await crypto.subtle.importKey('raw', pwHash, alg, false, ['decrypt']); // use pw to generate key
  const ctStr = atob(encrypted.slice(24)); // decode base64 ciphertext
  const ctUint8 = new Uint8Array(ctStr.match(/[\s\S]/g)!.map((ch) => ch.charCodeAt(0))); // ciphertext as Uint8Array
  const plainBuffer = await crypto.subtle.decrypt(alg, key, ctUint8); // decrypt ciphertext using key
  const plaintext = new TextDecoder().decode(plainBuffer); // decode password from UTF-8

  return plaintext.split(',');
}

export async function fetchMnemonic(accountId: string, password: string) {
  try {
    const mnemonicEncrypted = await getAccountValue(accountId, 'mnemonicsEncrypted') as string;
    const mnemonic = await decryptMnemonic(mnemonicEncrypted, password);

    if (!mnemonicEncrypted.includes(':')) {
      await tryMigratingMnemonicEncryption(accountId, mnemonic, password);
    }

    return mnemonic;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);

    return undefined;
  }
}

async function tryMigratingMnemonicEncryption(accountId: string, mnemonic: string[], password: string) {
  try {
    const mnemonicEncrypted = await encryptMnemonic(mnemonic, password);

    // This is a defensive approach against potential corrupted encryption reported by some users
    const decryptedMnemonic = await decryptMnemonic(mnemonicEncrypted, password)
      .catch(() => undefined);

    if (!password || !decryptedMnemonic) {
      return { error: ApiCommonError.DebugError };
    }

    await Promise.all([
      setAccountValue(accountId, 'mnemonicsEncrypted', mnemonicEncrypted),
    ]);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
  }

  return undefined;
}

export async function fetchPrivateKey(accountId: string, password: string) {
  try {
    const mnemonic = await fetchMnemonic(accountId, password);
    if (!mnemonic) {
      return undefined;
    }

    const seedBase64 = await mnemonicToSeed(mnemonic);
    const { secretKey: privateKey } = seedToKeyPair(seedBase64);

    return privateKey;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);

    return undefined;
  }
}

export async function fetchKeyPair(accountId: string, password: string) {
  try {
    const mnemonic = await fetchMnemonic(accountId, password);
    if (!mnemonic) {
      return undefined;
    }

    return await tonWebMnemonic.mnemonicToKeyPair(mnemonic);
  } catch (err) {
    logDebugError('fetchKeyPair', err);

    return undefined;
  }
}

export async function rawSign(accountId: string, password: string, dataHex: string) {
  const privateKey = await fetchPrivateKey(accountId, password);
  if (!privateKey) {
    return undefined;
  }

  const signature = nacl.sign.detached(hexToBytes(dataHex), privateKey);

  return bytesToHex(signature);
}

export async function verifyPassword(accountId: string, password: string) {
  const mnemonic = await fetchMnemonic(accountId, password);

  return Boolean(mnemonic);
}
