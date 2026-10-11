import type { ChainSdk } from '../../types/chains';
import { DappProtocolType } from '../../dappProtocols/types';

import { fetchNftByAddress } from './toncenter/nfts';
import { decryptComment, fetchActivityDetails, fetchActivitySlice } from './activities';
import { normalizeAddress } from './address';
import {
  fetchPrivateKeyString,
  generateMnemonic,
  getOtherVersionWallet,
  getWalletFromAddress,
  getWalletFromBip39Mnemonic,
  getWalletFromMnemonic,
  getWalletFromPrivateKey,
  validateMnemonic,
} from './auth';
import { TON_BIP39_PATH } from './constants';
import { signConnectionProof, signDappData, signDappTransfers } from './dapp';
import {
  checkDnsChangeWalletDraft,
  checkDnsRenewalDraft,
  submitDnsChangeWallet,
  submitDnsRenewal,
} from './domains';
import {
  checkNftOwnership,
  checkNftTransferDraft,
  getAccountNfts,
  streamAllAccountNfts,
  submitNftTransfers,
} from './nfts';
import { setupActivePolling, setupInactivePolling } from './polling';
import { fetchToken, importToken } from './tokens';
import { fetchTransactionById } from './transactionInfo';
import {
  checkToAddress,
  checkTransactionDraft,
  submitGasfullTransfer,
} from './transfer';
import {
  fetchBalances,
  fetchWalletPlugins,
  getWalletBalance,
} from './wallet';

const notSupported = () => {
  throw new Error('Not supported in TON');
};

const tonSdk: ChainSdk<'ton'> = {
  fetchActivitySlice,
  crosschain: undefined,
  fetchActivityDetails,
  decryptComment,
  normalizeAddress,
  getDefaultDerivation: () => ({ path: TON_BIP39_PATH, index: 0 }),
  getWalletFromBip39Mnemonic,
  getWalletFromPrivateKey,
  getWalletFromAddress,
  setupActivePolling,
  setupInactivePolling,
  fetchToken,
  importToken,
  checkTransactionDraft,
  submitGasfullTransfer,
  getAddressInfo: checkToAddress,
  getWalletBalance,
  getWalletAssets: fetchBalances,
  fetchPrivateKeyString,
  fetchTransactionById,
  dapp: {
    supportedProtocols: [DappProtocolType.TonConnect],
    signConnectionProof,
    signDappTransfers,
    signDappData,
  },
  getAccountNfts,
  streamAllAccountNfts,
  checkNftTransferDraft,
  submitNftTransfers,
  checkNftOwnership,
  fetchWalletPermissions: notSupported,
  revokeWalletPermission: notSupported,
  fetchWalletPlugins,
  fetchNftByAddress,
  dns: {
    checkDnsRenewalDraft,
    submitDnsRenewal,
    checkDnsChangeWalletDraft,
    submitDnsChangeWallet,
  },
  nativeMnemonic: {
    generateMnemonic,
    validateMnemonic,
    getWalletFromMnemonic,
  },
  getOtherVersionWallet,
};

// Staking reaches the SDK through a guarded `require` so a `NO_EXTRA_FEATURES` build drops its optional
// contracts from the bundle.
if (process.env.NO_EXTRA_FEATURES !== '1') {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const staking = require('./staking') as typeof import('./staking');
  /* eslint-enable @typescript-eslint/no-require-imports */

  tonSdk.staking = {
    checkStakeDraft: staking.checkStakeDraft,
    checkUnstakeDraft: staking.checkUnstakeDraft,
    submitStake: staking.submitStake,
    submitUnstake: staking.submitUnstake,
    submitTokenStakingClaim: staking.submitTokenStakingClaim,
    getCommonData: staking.getStakingCommonData,
  };
}

export default tonSdk;

// The chain methods that haven't been multichain-refactored yet:

export {
  getKeyPairFromStoredMnemonic,
} from './auth';
export {
  BACKEND_AUTH_SIGN_MESSAGE,
  buildBackendAuthToken,
} from './backendAuth';
export {
  checkTransactionDraft,
  submitGasfullTransfer,
  checkMultiTransactionDraft,
  submitMultiTransfer,
  signTransfers,
} from './transfer';
export {
  getWalletBalance,
  pickWalletByAddress,
} from './wallet';
export {
  insertMintlessPayload,
} from './tokens';
