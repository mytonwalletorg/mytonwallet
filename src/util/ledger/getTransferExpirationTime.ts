import { TRANSFER_TIMEOUT_SEC } from '../../api/chains/ton/constants';

export function getTransferExpirationTime() {
  return Math.floor(Date.now() / 1000 + TRANSFER_TIMEOUT_SEC);
}
