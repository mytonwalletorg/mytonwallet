import nacl from 'tweetnacl';
import * as tonWebMnemonic from 'tonweb-mnemonic';
import { Storage } from '../../storages/types';
import {
  base64ToBytes,
  bytesToBase64,
  bytesToHex,
  hexToBytes,
} from '../../common/utils';
import { toInternalAccountId } from '../../common/helpers';

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
  const pwUtf8 = new TextEncoder().encode(password); // encode password as UTF-8
  const pwHash = await crypto.subtle.digest('SHA-256', pwUtf8); // hash the password
  const iv = crypto.getRandomValues(new Uint8Array(12)); // get 96-bit random iv
  const alg = { name: 'AES-GCM', iv }; // specify algorithm to use
  const key = await crypto.subtle.importKey('raw', pwHash, alg, false, ['encrypt']); // generate key from pw
  const ptUint8 = new TextEncoder().encode(plaintext); // encode plaintext as UTF-8
  const ctBuffer = await crypto.subtle.encrypt(alg, key, ptUint8); // encrypt plaintext using key
  const ctArray = Array.from(new Uint8Array(ctBuffer)); // ciphertext as byte array
  const ctStr = ctArray.map((byte) => String.fromCharCode(byte)).join(''); // ciphertext as string
  // TODO Try `ctArray.toString('base64')` or `ctBuffer.toString('base64')`
  const ctBase64 = btoa(ctStr); // encode ciphertext as base64
  const ivHex = Array.from(iv).map((b) => (`00${b.toString(16)}`).slice(-2)).join(''); // iv as hex string

  return ivHex + ctBase64; // return iv+ciphertext
}

export async function decryptMnemonic(encrypted: string, password: string) {
  const pwUtf8 = new TextEncoder().encode(password); // encode password as UTF-8
  const pwHash = await crypto.subtle.digest('SHA-256', pwUtf8); // hash the password
  const iv = encrypted.slice(0, 24).match(/.{2}/g)!.map((byte) => parseInt(byte, 16)); // get iv from ciphertext
  const alg = { name: 'AES-GCM', iv: new Uint8Array(iv) }; // specify algorithm to use
  const key = await crypto.subtle.importKey('raw', pwHash, alg, false, ['decrypt']); // use pw to generate key
  const ctStr = atob(encrypted.slice(24)); // decode base64 ciphertext
  const ctUint8 = new Uint8Array(ctStr.match(/[\s\S]/g)!.map((ch) => ch.charCodeAt(0))); // ciphertext as Uint8Array
  // note: why doesn't ctUint8 = new TextEncoder().encode(ctStr) work?
  const plainBuffer = await crypto.subtle.decrypt(alg, key, ctUint8); // decrypt ciphertext using key
  const plaintext = new TextDecoder().decode(plainBuffer); // decode password from UTF-8
  return plaintext.split(',');
}

export async function fetchMnemonic(storage: Storage, accountId: string, password: string) {
  try {
    const internalId = toInternalAccountId(accountId);
    const mnemonicEncrypted = JSON.parse(await storage.getItem('mnemonicsEncrypted'))[internalId]!;
    return await decryptMnemonic(mnemonicEncrypted, password);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);

    return undefined;
  }
}

export async function fetchPrivateKey(storage: Storage, accountId: string, password: string) {
  try {
    const mnemonic = await fetchMnemonic(storage, accountId, password);
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

export async function fetchPublicKey(storage: Storage, accountId: string): Promise<string> {
  const internalId = toInternalAccountId(accountId);
  const publicKeysJson = (await storage.getItem('publicKeys'))!;
  const publicKeys = JSON.parse(publicKeysJson);
  return publicKeys[internalId];
}

export async function rawSign(storage: Storage, accountId: string, password: string, dataHex: string) {
  const privateKey = await fetchPrivateKey(storage, accountId, password);
  if (!privateKey) {
    return undefined;
  }

  const signature = nacl.sign.detached(hexToBytes(dataHex), privateKey);

  return bytesToHex(signature);
}

export async function verifyPassword(storage: Storage, accountId: string, password: string) {
  const mnemonic = await fetchMnemonic(storage, accountId, password);

  return Boolean(mnemonic);
}
