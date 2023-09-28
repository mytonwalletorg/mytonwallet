import {
  TonClient,
  WalletContractV1R1,
  WalletContractV1R2,
  WalletContractV1R3,
  WalletContractV2R1,
  WalletContractV2R2,
  WalletContractV3R1,
  WalletContractV3R2,
  WalletContractV4,
} from 'ton';
import axios from 'axios';

import type { ApiNetwork, ApiWalletVersion } from '../../../types';
import { WORKCHAIN } from '../../../types';

import { TONHTTPAPI_MAINNET_URL, TONHTTPAPI_TESTNET_URL } from '../../../../config';
import { hexToBytes } from '../../../common/utils';

type TonWallet = typeof WalletContractV1R1
| typeof WalletContractV1R2
| typeof WalletContractV1R3
| typeof WalletContractV2R1
| typeof WalletContractV2R2
| typeof WalletContractV3R1
| typeof WalletContractV3R2
| typeof WalletContractV4;

axios.defaults.adapter = require('../../../../lib/axios-fetch-adapter').default;

const clientByNetwork: Record<ApiNetwork, TonClient> = {
  mainnet: new TonClient({ endpoint: TONHTTPAPI_MAINNET_URL }),
  testnet: new TonClient({ endpoint: TONHTTPAPI_TESTNET_URL }),
};

const walletClassMap: Record<ApiWalletVersion, TonWallet | undefined> = {
  simpleR1: WalletContractV1R1,
  simpleR2: WalletContractV1R2,
  simpleR3: WalletContractV1R3,
  v2R1: WalletContractV2R1,
  v2R2: WalletContractV2R2,
  v3R1: WalletContractV3R1,
  v3R2: WalletContractV3R2,
  v4R1: undefined, // Not relevant
  v4R2: WalletContractV4,
};

export function getTonWalletContract(publicKeyHex: string, version: ApiWalletVersion) {
  const walletClass = walletClassMap[version];
  if (!walletClass) {
    throw new Error('Unsupported wallet contract version');
  }

  const publicKey = Buffer.from(hexToBytes(publicKeyHex));
  return walletClass.create({ workchain: WORKCHAIN, publicKey });
}

export function getTonClient(network: ApiNetwork) {
  return clientByNetwork[network];
}
