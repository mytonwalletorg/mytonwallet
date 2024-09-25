import { beginCell, type Cell } from '@ton/core';
import { sign } from '@ton/crypto';

const Opcodes = {
  action_send_msg: 0x0ec3c86d,
  action_set_code: 0xad4de08e,
  action_extended_set_data: 0x1ff8ea0b,
  action_extended_add_extension: 0x02,
  action_extended_remove_extension: 0x03,
  action_extended_set_signature_auth_allowed: 0x04,
  auth_extension: 0x6578746e,
  auth_signed: 0x7369676e,
  auth_signed_internal: 0x73696e74,
};

export function bufferToBigInt(buffer: Buffer): bigint {
  return BigInt(`0x${buffer.toString('hex')}`);
}

export function createBody(actionsList: Cell, seqno: number, secretKey: Buffer, timeout: number) {
  const payload = beginCell()
    .storeUint(Opcodes.auth_signed_internal, 32)
    // TODO: calculate walletId
    .storeUint(2147483409n, 32)
    .storeUint(Math.floor((Date.now() + timeout) / 1000), 32)
    .storeUint(seqno, 32)
    .storeSlice(actionsList.beginParse())
    .endCell();

  const signature = sign(payload.hash(), secretKey);
  return beginCell()
    .storeSlice(payload.beginParse())
    .storeUint(bufferToBigInt(signature), 512)
    .endCell();
}
