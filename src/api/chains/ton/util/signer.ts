import type { Address, Cell } from '@ton/core';
import type { SignDataPayload } from '@tonconnect/protocol';
import type { SignKeyPair } from 'tweetnacl';
import { WalletContractV5R1 } from '@ton/ton/dist/wallets/WalletContractV5R1';

import type { ApiTonConnectProof } from '../../../tonConnect/types';
import type { ApiAccountWithTon, ApiAnyDisplayError, ApiNetwork, ApiTonWallet } from '../../../types';
import type { ApiTonWalletVersion, PreparedTransactionToSign } from '../types';
import { ApiTransactionError } from '../../../types';

import { hexToBytes } from '../../../common/utils';
import { signDataWithPrivateKey, signTonProofWithPrivateKey } from '../../../tonConnect/signing';
import { buildWallet } from '../wallet';
import { signTonProofWithLedger, signTonTransactionsWithLedger } from './ledger';

/**
 * Signs TON stuff
 */
export interface Signer {
  signTonProof(proof: ApiTonConnectProof): MaybePromise<Buffer>;
  /**
   * The output Cell order matches the input transactions order exactly.
   * Error is _returned_ only for expected errors, i.e. caused not by mistakes in the app code.
   */
  signTransactions(transactions: PreparedTransactionToSign[]): MaybePromise<Cell[] | { error: ApiAnyDisplayError }>;
  /**
   * See https://docs.tonconsole.com/academy/sign-data#how-the-signature-is-built for more details.
   *
   * @params timestamp The current time in Unix seconds
   */
  signData(
    timestamp: number,
    domain: string,
    payload: SignDataPayload,
  ): MaybePromise<Buffer | { error: ApiAnyDisplayError }>;
}

class PrivateKeySigner implements Signer {
  constructor(
    public walletAddress: string | Address,
    public walletVersion: ApiTonWalletVersion,
    public getKeyPair: () => MaybePromise<SignKeyPair>,
  ) {}

  async signTonProof(proof: ApiTonConnectProof) {
    const { secretKey } = await this.getKeyPair();
    const signature = await signTonProofWithPrivateKey(this.walletAddress, secretKey, proof);
    return Buffer.from(signature);
  }

  async signTransactions(transactions: PreparedTransactionToSign[]) {
    const keyPair = await this.getKeyPair();
    return signTransactionsWithKeyPair(transactions, this.walletVersion, keyPair);
  }

  async signData(timestamp: number, domain: string, payload: SignDataPayload) {
    const { secretKey } = await this.getKeyPair();
    const signature = await signDataWithPrivateKey(
      this.walletAddress,
      timestamp,
      domain,
      payload,
      secretKey,
    );
    return Buffer.from(signature);
  }
}

class LedgerSigner implements Signer {
  constructor(
    public network: ApiNetwork,
    public wallet: ApiTonWallet,
    public subwalletId?: number,
  ) {}

  async signTonProof(proof: ApiTonConnectProof) {
    // todo: Handle user rejection
    return signTonProofWithLedger(this.network, this.wallet, proof);
  }

  async signTransactions(transactions: PreparedTransactionToSign[]) {
    return signTonTransactionsWithLedger(this.network, this.wallet, transactions, this.subwalletId);
  }

  signData() {
    // No Ledger TON app version supports SignData yet. The support is expected to be added soon.
    return { error: ApiTransactionError.NotSupportedHardwareOperation };
  }
}

export function getSigner(
  network: ApiNetwork,
  account: ApiAccountWithTon,
  privateKey?: Uint8Array,
  /** Set `true` if you only need to emulate the transaction */
  isMockSigning?: boolean,
  /** Used for specific transactions on vesting.ton.org */
  ledgerSubwalletId?: number,
): Signer {
  const wallet = account.ton;

  if (isMockSigning || account.type === 'view') {
    return new PrivateKeySigner(
      wallet.address,
      wallet.version,
      () => ({
        publicKey: wallet.publicKey ? hexToBytes(wallet.publicKey) : Buffer.alloc(64),
        secretKey: Buffer.alloc(64),
      }),
    );
  }

  if (account.type === 'ledger') {
    return new LedgerSigner(network, wallet, ledgerSubwalletId);
  }

  if (!privateKey) throw new Error('Private key not provided');
  if (!wallet.publicKey) throw new Error('The wallet has no public key');
  const keyPair = {
    publicKey: hexToBytes(wallet.publicKey),
    secretKey: privateKey,
  };
  return new PrivateKeySigner(
    wallet.address,
    wallet.version,
    () => keyPair,
  );
}

function signTransactionsWithKeyPair(
  transactions: PreparedTransactionToSign[],
  walletVersion: ApiTonWalletVersion,
  keyPair: SignKeyPair,
) {
  const secretKey = Buffer.from(keyPair.secretKey);
  const wallet = buildWallet(keyPair.publicKey, walletVersion);

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
      throw new Error(`${walletVersion} wallet doesn't support authType "${authType}"`);
    }

    return wallet.createTransfer({ ...transaction, secretKey });
  });
}
