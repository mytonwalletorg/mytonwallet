import type { ApiNetwork, ApiSwapBuildRequest, ApiTokensTransferPayload } from '../../types';
import type { TonTransferParams } from './types';

import { SWAP_FEE_ADDRESS, TON_SYMBOL } from '../../../config';
import { assert } from '../../../util/assert';
import { fromDecimal } from '../../../util/decimals';
import { parsePayloadBase64 } from './util/metadata';
import { resolveTokenWalletAddress, toBase64Address } from './util/tonCore';
import { findTokenByMinter } from './tokens';
import { getContractInfo } from './wallet';

const MEGATON_WTON_MINTER = 'EQCajaUU1XXSAjTD-xOV7pE49fGtg4q8kF3ELCOJtGvQFQ2C';
const MAX_NETWORK_FEE = 1000000000n; // 1 TON

export async function validateDexSwapTransfers(
  network: ApiNetwork,
  address: string,
  params: ApiSwapBuildRequest,
  transfers: TonTransferParams[],
) {
  assert(transfers.length <= 2);

  const [mainTransfer, feeTransfer] = transfers;

  if (params.from === TON_SYMBOL) {
    const maxAmount = fromDecimal(params.fromAmount) + MAX_NETWORK_FEE;
    const { isSwapAllowed, codeHash } = await getContractInfo(network, mainTransfer.toAddress);

    assert(!!isSwapAllowed, `Not allowed swap contract: ${codeHash} ${mainTransfer.toAddress}`);
    assert(mainTransfer.amount <= maxAmount);

    if (feeTransfer) {
      assert(feeTransfer.amount <= mainTransfer.amount);
      assert(feeTransfer.amount + mainTransfer.amount < maxAmount);
      assert(toBase64Address(feeTransfer.toAddress, false) === SWAP_FEE_ADDRESS);
    }
  } else {
    const token = findTokenByMinter(params.from)!;
    assert(!!token);

    const maxAmount = fromDecimal(params.fromAmount, token.decimals);
    const maxTonAmount = MAX_NETWORK_FEE;

    const walletAddress = await resolveTokenWalletAddress(network, address, token.minterAddress!);
    const parsedPayload = await parsePayloadBase64(network, mainTransfer.toAddress, mainTransfer.payload as string);

    let destination: string;
    let tokenAmount = 0n;

    if (mainTransfer.toAddress === MEGATON_WTON_MINTER) {
      destination = mainTransfer.toAddress;
      assert(mainTransfer.toAddress === token.minterAddress);
    } else {
      assert(mainTransfer.toAddress === walletAddress);
      assert(['tokens:transfer', 'tokens:transfer-non-standard'].includes(parsedPayload.type));

      ({ amount: tokenAmount, destination } = parsedPayload as ApiTokensTransferPayload);
      assert(tokenAmount <= maxAmount);
    }

    assert(mainTransfer.amount < maxTonAmount);

    const { isSwapAllowed } = await getContractInfo(network, destination);

    assert(!!isSwapAllowed);

    if (feeTransfer) {
      const feePayload = await parsePayloadBase64(network, feeTransfer.toAddress, feeTransfer.payload as string);

      assert(feeTransfer.amount + mainTransfer.amount < maxTonAmount);
      assert(feeTransfer.toAddress === walletAddress);
      assert(['tokens:transfer', 'tokens:transfer-non-standard'].includes(feePayload.type));

      const { amount: tokenFeeAmount, destination: feeDestination } = feePayload as ApiTokensTransferPayload;

      assert(tokenFeeAmount < tokenAmount);
      assert(tokenAmount + tokenFeeAmount <= maxAmount);
      assert(toBase64Address(feeDestination, false) === SWAP_FEE_ADDRESS);
    }
  }
}
