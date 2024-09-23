import * as tonWebMnemonic from 'tonweb-mnemonic';
import * as bip39 from 'bip39';
import nacl from 'tweetnacl';

import type {
  ApiLedgerAccount, ApiNetwork, ApiTonAccount, ApiTonWallet,
} from '../../types';
import type { ApiTonWalletVersion } from './types';
import type { TonWallet } from './util/tonCore';

import * as HDKey from '../../../lib/ed25519-hd-key';
import { parseAccountId } from '../../../util/account';
import isMnemonicPrivateKey from '../../../util/isMnemonicPrivateKey';
import { logDebugError } from '../../../util/logs';
import { toBase64Address } from './util/tonCore';
import { fetchStoredAccount, getNewAccountId, setAccountValue } from '../../common/accounts';
import { fetchMnemonic, validateBip39Mnemonic } from '../../common/mnemonic';
import { bytesToHex, hexToBytes } from '../../common/utils';
import { TON_BIP39_PATH } from './constants';
import { buildWallet, pickBestWallet, publicKeyToAddress } from './wallet';

export function generateMnemonic() {
  return tonWebMnemonic.generateMnemonic();
}

export function validateMnemonic(mnemonic: string[]) {
  return tonWebMnemonic.validateMnemonic(mnemonic);
}

export function privateKeyHexToKeyPair(privateKeyHex: string) {
  return nacl.sign.keyPair.fromSeed(hexToBytes(privateKeyHex));
}

export function mnemonicToKeyPair(mnemonic: string[]) {
  return validateBip39Mnemonic(mnemonic)
    ? bip39MnemonicToKeyPair(mnemonic)
    : tonWebMnemonic.mnemonicToKeyPair(mnemonic);
}

export async function fetchPrivateKey(accountId: string, password: string) {
  try {
    const { secretKey: privateKey } = await fetchKeyPair(accountId, password) || {};

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

    return isMnemonicPrivateKey(mnemonic) ? privateKeyHexToKeyPair(mnemonic[0]) : await mnemonicToKeyPair(mnemonic);
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

export function getWalletFromBip39Mnemonic(
  network: ApiNetwork,
  mnemonic: string[],
  version?: ApiTonWalletVersion,
): Promise<ApiTonWallet> {
  const { publicKey } = bip39MnemonicToKeyPair(mnemonic);
  return getWalletFromKeys(publicKey, network, version);
}

export async function getWalletFromMnemonic(
  mnemonic: string[],
  network: ApiNetwork,
  version?: ApiTonWalletVersion,
): Promise<ApiTonWallet> {
  const { publicKey } = await mnemonicToKeyPair(mnemonic);
  return getWalletFromKeys(publicKey, network, version);
}

export function getWalletFromPrivateKey(
  privateKey: string,
  network: ApiNetwork,
  version?: ApiTonWalletVersion,
): Promise<ApiTonWallet> {
  const { publicKey } = privateKeyHexToKeyPair(privateKey);
  return getWalletFromKeys(publicKey, network, version);
}

async function getWalletFromKeys(
  publicKey: Uint8Array,
  network: ApiNetwork,
  version?: ApiTonWalletVersion,
): Promise<ApiTonWallet> {
  let wallet: TonWallet;
  if (version) {
    wallet = buildWallet(network, publicKey, version);
  } else {
    ({ wallet, version } = await pickBestWallet(network, publicKey));
  }

  const address = toBase64Address(wallet.address, false, network);
  const publicKeyHex = bytesToHex(publicKey);

  return {
    type: 'ton',
    publicKey: publicKeyHex,
    address,
    version,
    index: 0,
  };
}

function bip39MnemonicToKeyPair(mnemonic: string[]) {
  const hexSeed = bip39.mnemonicToSeedSync(mnemonic.join(' '));
  const { key: privateKey } = HDKey.derivePath(TON_BIP39_PATH, hexSeed.toString('hex'));
  return nacl.sign.keyPair.fromSeed(privateKey);
}

export async function importNewWalletVersion(accountId: string, version: ApiTonWalletVersion) {
  const { network } = parseAccountId(accountId);

  const account = await fetchStoredAccount<ApiTonAccount | ApiLedgerAccount>(accountId);
  const publicKey = hexToBytes(account.ton.publicKey);

  const newAddress = publicKeyToAddress(network, publicKey, version);
  const newAccountId = await getNewAccountId(network);
  const newAccount: ApiTonAccount | ApiLedgerAccount = {
    ...account,
    ton: {
      type: 'ton',
      address: newAddress,
      publicKey: account.ton.publicKey,
      version,
      index: account.ton.index,
    },
  };

  const ledger = account.type === 'ledger'
    ? { index: account.ton.index, driver: account.driver }
    : undefined;

  await setAccountValue(newAccountId, 'accounts', newAccount);

  return {
    accountId: newAccountId,
    address: newAddress,
    ledger,
  };
}
