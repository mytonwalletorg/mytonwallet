import type {
  ApiDappTransfer,
  ApiNftTransferPayload,
  ApiParsedPayload,
  ApiTokensTransferNonStandardPayload,
  ApiTokensTransferPayload,
} from '../../api/types';

export function isNftTransferPayload(payload: ApiParsedPayload | undefined): payload is ApiNftTransferPayload {
  return payload?.type === 'nft:transfer';
}

export function isTokenTransferPayload(
  payload: ApiParsedPayload | undefined,
): payload is ApiTokensTransferPayload | ApiTokensTransferNonStandardPayload {
  return payload?.type === 'tokens:transfer' || payload?.type === 'tokens:transfer-non-standard';
}

export function getDappTransferActualToAddress(transfer: ApiDappTransfer) {
  // This function implementation is not complete. That is, other transfer types may have another actual "to" address.
  if (isNftTransferPayload(transfer.payload)) {
    return transfer.payload.newOwner;
  }
  if (isTokenTransferPayload(transfer.payload)) {
    return transfer.payload.destination;
  }
  return transfer.toAddress;
}

export function isTransferPayloadDangerous(payload: ApiParsedPayload | undefined) {
  return payload?.type === 'unknown';
}
