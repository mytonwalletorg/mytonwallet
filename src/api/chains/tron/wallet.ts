import type { TronWeb } from 'tronweb';

import type { ApiNetwork } from '../../types';

import { logDebugError } from '../../../util/logs';
import { getTronClient } from './util/tronweb';

/*
* We display unconfirmed balance and transactions to user.
* /wallet/* - endpoints with unconfirmed data
* /walletsolidity/* - endpoints with confirmed data
*/

export async function getWalletBalance(network: ApiNetwork, address: string) {
  const tronWeb = getTronClient(network);
  return BigInt(await tronWeb.trx.getUnconfirmedBalance(address));
}

export async function getTrc20Balance(network: ApiNetwork, tokenAddress: string, address: string) {
  const result = await callContract(getTronClient(network), tokenAddress, 'balanceOf(address)', [
    { type: 'address', value: address },
  ], address);

  if (!result.length) {
    return 0n;
  }

  return BigInt(`0x${result[0]}`);
}

export async function callContract(
  tronWeb: TronWeb,
  address: string,
  functions: string,
  parameters: any[] = [],
  issuerAddress: string,
) {
  try {
    const result = await tronWeb.transactionBuilder.triggerSmartContract(
      address,
      functions,
      { _isConstant: true },
      parameters,
      issuerAddress,
    );
    return result && result.result ? result.constant_result : [];
  } catch (err: any) {
    logDebugError('callContract', err);
    return [];
  }
}
