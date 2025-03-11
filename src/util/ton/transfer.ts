import type {
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
