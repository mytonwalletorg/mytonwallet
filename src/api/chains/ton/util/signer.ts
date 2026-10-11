import type { Cell } from '@ton/core';
import type { SignDataPayload } from '@tonconnect/protocol';
import { WalletContractV5R1 } from '@ton/ton/dist/wallets/WalletContractV5R1';

import type { TonConnectProof } from '../../../dappProtocols/adapters';
import type {
  ApiAccountWithChain,
  ApiAnyDisplayError,
  ApiTonWallet,
} from '../../../types';
import type { PreparedTransactionToSign } from '../types';
import { ApiCommonError } from '../../../types';

import { randomBytes } from '../../../../util/random';
import { hexToBytes } from '../../../common/utils';
import { signDataWithPrivateKey, signTonProofWithPrivateKey } from '../../../dappProtocols/adapters/tonConnect/signing';
import { fetchPrivateKey } from '../auth';
import { getTonWallet } from '../wallet';

type ErrorResult = { error: ApiAnyDisplayError };

/**
 * Signs, encrypts and decrypts TON stuff.
 *
 * For all the methods: error is _returned_ only for expected errors, i.e. caused not by mistakes in the app code.
 */
export interface Signer {
  /** Whether the signer produces invalid signatures and encryption, for example for emulation */
  readonly isMock: boolean;
  signTonProof(proof: TonConnectProof): MaybePromise<Buffer | ErrorResult>;
  /** The output Cell order matches the input transactions order exactly. */
  signTransactions(
    transactions: PreparedTransactionToSign[],
    isTonConnect?: boolean,
  ): MaybePromise<Cell[] | ErrorResult>;
  /**
   * See https://docs.tonconsole.com/academy/sign-data#how-the-signature-is-built for more details.
   *
   * @params timestamp The current time in Unix seconds
   */
  signData(
    timestamp: number,
    domain: string,
    payload: SignDataPayload,
  ): MaybePromise<Buffer | ErrorResult>;
  /** @ignore This is not signing, but it's a part of this interface to eliminate excess private key fetching. */
  encryptComment(comment: string, recipientPublicKey: Uint8Array): MaybePromise<Buffer | ErrorResult>;
  decryptComment(encrypted: Uint8Array, senderAddress: string): MaybePromise<string | ErrorResult>;
}

/** Building a signer performs no I/O and reads no secret; both happen on the first signature. */
export function getSigner(
  accountId: string,
  account: ApiAccountWithChain<'ton'>,
  /** Required for mnemonic accounts when the mock signing is off */
  enclaveToken?: string,
  /** Set `true` if you only need to emulate the transaction */
  isMockSigning?: boolean,
): Signer {
  if (isMockSigning || account.type === 'view') {
    return new MockSigner(account.byChain.ton);
  }

  if (enclaveToken === undefined) throw new Error('Preauthorization ID not provided');

  return new MnemonicSigner(
    account.byChain.ton,
    () => fetchPrivateKey(accountId, enclaveToken, account),
  );
}

abstract class PrivateKeySigner implements Signer {
  abstract readonly isMock: boolean;

  constructor(public wallet: ApiTonWallet) {}

  abstract getPrivateKey(): MaybePromise<Uint8Array | ErrorResult>;

  async signTonProof(proof: TonConnectProof) {
    const privateKey = await this.getPrivateKey();
    if ('error' in privateKey) return privateKey;

    const signature = await signTonProofWithPrivateKey(this.wallet.address, privateKey, proof);
    return Buffer.from(signature);
  }

  async signTransactions(transactions: PreparedTransactionToSign[]) {
    const privateKey = await this.getPrivateKey();
    if ('error' in privateKey) return privateKey;

    return signTransactionsWithPrivateKey(transactions, this.wallet, privateKey);
  }

  async signData(timestamp: number, domain: string, payload: SignDataPayload) {
    const privateKey = await this.getPrivateKey();
    if ('error' in privateKey) return privateKey;

    const signature = await signDataWithPrivateKey(
      this.wallet.address,
      timestamp,
      domain,
      payload,
      privateKey,
    );
    return Buffer.from(signature);
  }

  async encryptComment(comment: string, recipientPublicKey: Uint8Array) {
    const privateKey = await this.getPrivateKey();
    if ('error' in privateKey) return privateKey;

    const encrypted = await requireEncryption().encryptMessageComment(
      comment,
      this.getPublicKey(),
      recipientPublicKey,
      privateKey,
      this.wallet.address,
    );
    return Buffer.from(encrypted.buffer, encrypted.byteOffset, encrypted.byteLength);
  }

  async decryptComment(encrypted: Uint8Array, senderAddress: string) {
    const privateKey = await this.getPrivateKey();
    if ('error' in privateKey) return privateKey;

    return requireEncryption().decryptMessageComment(encrypted, this.getPublicKey(), privateKey, senderAddress);
  }

  getPublicKey() {
    const publicKeyHex = this.wallet.publicKey;
    if (!publicKeyHex) {
      // Mnemonic wallets must always have a public key. This error happens when a developer provides a wrong wallet type.
      throw new Error('Public key is missing');
    }
    return hexToBytes(publicKeyHex);
  }
}

/**
 * Loaded lazily so a `NO_EXTRA_FEATURES` build drops the module together with its aes-js and
 * noble-ed25519 dependencies, which exist only for this feature.
 */
function requireEncryption() {
  // `process.env` is read inline, not through the `config` re-exports: Webpack substitutes it before
  // dead-code elimination, so the `require` below sits in a statically false branch and the module — with
  // its aes-js and noble-ed25519 dependencies — is dropped from the bundle entirely.
  if (process.env.NO_EXTRA_FEATURES !== '1') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('./encryption') as typeof import('./encryption');
  }

  throw new Error('Encrypted comments are not supported in this build');
}

class MnemonicSigner extends PrivateKeySigner {
  public isMock = false;

  private privateKey?: Promise<Uint8Array | ErrorResult>;

  constructor(
    wallet: ApiTonWallet,
    private fetchKey: () => Promise<Uint8Array | undefined>,
  ) {
    super(wallet);
  }

  /**
   * The key is read on the first signature rather than when the signer is built, and the promise is
   * kept so every later signature reuses that one read. Two properties come out of this: an operation
   * spends exactly one Enclave session usage no matter how many times it signs, and the raw key is
   * absent from memory during whatever the caller does between building a signer and signing - which
   * is where the network round trips live, and where a failure would otherwise have held the key for
   * nothing. Callers that build a signer and never sign read nothing at all.
   */
  public getPrivateKey() {
    this.privateKey ??= this.fetchKey().then((key) => key ?? { error: ApiCommonError.InvalidPassword });

    return this.privateKey;
  }
}

class MockSigner extends PrivateKeySigner {
  public isMock = true;
  private readonly privateKey = randomBytes(64);

  public getPrivateKey() {
    return this.privateKey;
  }
}

function signTransactionsWithPrivateKey(
  transactions: PreparedTransactionToSign[],
  storedWallet: ApiTonWallet,
  secretKeyUint8Array: Uint8Array,
) {
  const secretKey = Buffer.from(secretKeyUint8Array);
  const wallet = getTonWallet(storedWallet);

  return transactions.map((transaction) => {
    if (wallet instanceof WalletContractV5R1) {
      return wallet.createTransfer({
        ...transaction,
        // TODO Remove it. There is bug in @ton/ton library that causes transactions to be executed in reverse order.
        messages: [...transaction.messages].reverse(),
        secretKey,
      });
    }

    const { authType = 'external' } = transaction;
    if (authType !== 'external') {
      throw new Error(`${storedWallet.version} wallet doesn't support authType "${authType}"`);
    }

    return wallet.createTransfer({ ...transaction, secretKey });
  });
}
