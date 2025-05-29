import * as tonWebMnemonic from 'tonweb-mnemonic';
import * as bip39 from 'bip39';
import nacl from 'tweetnacl';

import type {
  ApiAccountWithMnemonic,
  ApiLedgerAccount,
  ApiNetwork,
  ApiTonAccount,
  ApiTonWallet,
} from '../../types';
import type { ApiTonWalletVersion } from './types';
import type { TonWallet } from './util/tonCore';
import { ApiAuthError } from '../../types';

import { DEFAULT_WALLET_VERSION } from '../../../config';
import * as HDKey from '../../../lib/ed25519-hd-key';
import { parseAccountId } from '../../../util/account';
import isMnemonicPrivateKey from '../../../util/isMnemonicPrivateKey';
import { omitUndefined } from '../../../util/iteratees';
import { logDebugError } from '../../../util/logs';
import { getWalletPublicKey, toBase64Address } from './util/tonCore';
import { fetchStoredAccount, getNewAccountId, setAccountValue } from '../../common/accounts';
import { getMnemonic } from '../../common/mnemonic';
import { bytesToHex, hexToBytes } from '../../common/utils';
import { resolveAddress } from './address';
import { TON_BIP39_PATH } from './constants';
import { buildWallet, getWalletInfo, pickBestWallet, publicKeyToAddress } from './wallet';

export function generateMnemonic() {
  return tonWebMnemonic.generateMnemonic();
}

export function validateMnemonic(mnemonic: string[]) {
  return tonWebMnemonic.validateMnemonic(mnemonic);
}

export function privateKeyHexToKeyPair(privateKeyHex: string) {
  return nacl.sign.keyPair.fromSeed(hexToBytes(privateKeyHex));
}

export async function fetchPrivateKey(accountId: string, password: string, account?: ApiAccountWithMnemonic) {
  try {
    const { secretKey: privateKey } = await fetchKeyPair(accountId, password, account) || {};

    return privateKey;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);

    return undefined;
  }
}

export async function fetchKeyPair(accountId: string, password: string, account?: ApiAccountWithMnemonic) {
  try {
    account = account ?? await fetchStoredAccount<ApiAccountWithMnemonic>(accountId);
    const mnemonic = await getMnemonic(accountId, password, account);
    if (!mnemonic) {
      return undefined;
    }

    if (isMnemonicPrivateKey(mnemonic)) {
      return privateKeyHexToKeyPair(mnemonic[0]);
    } else if (account.type === 'bip39') {
      return bip39MnemonicToKeyPair(mnemonic);
    } else {
      return await tonWebMnemonic.mnemonicToKeyPair(mnemonic);
    }
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
): Promise<ApiTonWallet & { lastTxId?: string }> {
  const { publicKey } = await tonWebMnemonic.mnemonicToKeyPair(mnemonic);
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
): Promise<ApiTonWallet & { lastTxId?: string }> {
  let wallet: TonWallet;
  let lastTxId: string | undefined;
  if (version) {
    wallet = buildWallet(publicKey, version);
  } else {
    ({ wallet, version, lastTxId } = await pickBestWallet(network, publicKey));
  }

  const address = toBase64Address(wallet.address, false, network);
  const publicKeyHex = bytesToHex(publicKey);

  return {
    type: 'ton',
    publicKey: publicKeyHex,
    address,
    version,
    index: 0,
    lastTxId,
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
  if (!account.ton.publicKey) {
    throw new Error(`Account ${accountId} has no public key`);
  }

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

export async function getWalletFromAddress(
  network: ApiNetwork,
  addressOrDomain: string,
): Promise<{ title?: string; wallet: ApiTonWallet } | { error: ApiAuthError }> {
  const resolvedAddress = await resolveAddress(network, addressOrDomain, true);
  if (resolvedAddress === 'dnsNotResolved') return { error: ApiAuthError.DomainNotResolved };
  if (resolvedAddress === 'invalidAddress') return { error: ApiAuthError.InvalidAddress };
  const rawAddress = resolvedAddress.address;

  const [walletInfo, publicKey] = await Promise.all([
    getWalletInfo(network, rawAddress),
    getWalletPublicKey(network, rawAddress),
  ]);

  return {
    title: resolvedAddress.name,
    wallet: omitUndefined<ApiTonWallet>({
      type: 'ton',
      publicKey: publicKey ? bytesToHex(publicKey) : undefined,
      address: walletInfo.address,
      // The wallet has no version until it's initialized as a wallet. Using the default version just for the type
      // compliance, it plays no role for view wallets anyway.
      version: walletInfo?.version ?? DEFAULT_WALLET_VERSION,
      index: 0,
      isInitialized: walletInfo?.isInitialized ?? false,
    }),
  };
}
