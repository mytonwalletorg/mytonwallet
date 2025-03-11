import type { ApiDappTransfer, ApiParsedPayload } from '../types';

import { isNftTransferPayload, isTokenTransferPayload } from '../../util/ton/transfer';
import { ONE_TON } from '../chains/ton/constants';

const MAX_SINGLE_AMOUNT_AS_FEE = 1n * ONE_TON;
const MAX_TOTAL_AMOUNT_AS_FEE = 3n * ONE_TON;

export function isValidString(value: any, maxLength = 100) {
  return typeof value === 'string' && value.length <= maxLength;
}

export function isValidUrl(url: string) {
  const isString = isValidString(url, 255);
  if (!isString) return false;

  try {
    // eslint-disable-next-line no-new
    new URL(url);
    return true;
  } catch (err) {
    return false;
  }
}

export function getTransferActualToAddress(toAddress: string, payload: ApiParsedPayload | undefined) {
  // This function implementation is not complete. That is, other transfer types may have another actual "to" address.
  if (isNftTransferPayload(payload)) {
    return payload.newOwner;
  }
  if (isTokenTransferPayload(payload)) {
    return payload.destination;
  }
  return toAddress;
}

export function isTransferPayloadDangerous(payload: ApiParsedPayload | undefined) {
  return payload?.type === 'unknown';
}

/**
 * If applicable and safe, makes the transfers' amounts act as a fee. Returns a mapped list of the given dapp transfers.
 */
export function showDappTransferAmountsAsFee(transfers: ApiDappTransfer[]) {
  // Large TON amounts should be shown as a fee, because the fee is barely noticeable in the UI. This function doesn't
  // consider the emulated `received` amount, because it's not reliable and can be tampered by scammers.

  const totalAmountAsFee = transfers.reduce((sum, transfer) => (
    sum + (shouldShowTransferAmountAsFee(transfer) ? transfer.displayedAmount : 0n)
  ), 0n);

  if (totalAmountAsFee === 0n || totalAmountAsFee > MAX_TOTAL_AMOUNT_AS_FEE) {
    return transfers;
  }

  return transfers.map((transfer) => {
    if (!shouldShowTransferAmountAsFee(transfer)) {
      return transfer;
    }
    return {
      ...transfer,
      displayedAmount: 0n,
      fullFee: transfer.fullFee + transfer.displayedAmount,
    };
  });
}

function shouldShowTransferAmountAsFee({ amount, payload }: ApiDappTransfer) {
  return amount <= MAX_SINGLE_AMOUNT_AS_FEE
    && (isNftTransferPayload(payload) || isTokenTransferPayload(payload));
}
