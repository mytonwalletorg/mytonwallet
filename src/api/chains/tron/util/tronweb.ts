import { TronWeb } from 'tronweb';

import type { ApiNetwork } from '../../../types';

import { getChainConfig } from '../../../../util/chain';

let clientByNetwork: Record<ApiNetwork, TronWeb> | undefined;

const parametersByNetwork: Partial<Record<ApiNetwork, {
  energyUnitFee: number;
  bandwidthUnitFee: number;
}>> = {};

const chainConfig = getChainConfig('tron');

export function getTronClient(network: ApiNetwork = 'mainnet') {
  if (!clientByNetwork) {
    clientByNetwork = {
      mainnet: new TronWeb({
        fullHost: chainConfig.mainnet.apiUrl,
      }),
      testnet: new TronWeb({
        fullHost: chainConfig.testnet.apiUrl,
      }),
    };
  }

  return clientByNetwork[network];
}

export async function getChainParameters(network: ApiNetwork) {
  if (!(network in parametersByNetwork)) {
    const chainParameters = await getTronClient(network).trx.getChainParameters();
    const energyUnitFee = chainParameters.find((param) => param.key === 'getEnergyFee')!.value;
    const bandwidthUnitFee = chainParameters.find((param) => param.key === 'getTransactionFee')!.value;
    parametersByNetwork[network] = { energyUnitFee, bandwidthUnitFee };
  }

  return parametersByNetwork[network]!;
}
