import type { Cell } from '@ton/core';
import { beginCell, external, storeMessage } from '@ton/core';

import type { ApiEmulatedTransaction, ApiEmulationResult, ApiNetwork } from '../../../types';
import type { EmulationResponse, EmulationTransaction, EmulationTransactionMessage } from '../toncenter/emulation';
import type { TraceDetail } from '../toncenter/types';
import type { ApiTransactionExtended } from '../types';
import type { TonWallet } from './tonCore';

import { TONCOIN } from '../../../../config';
import { buildTxId } from '../../../../util/activities';
import { bigintAbs, bigintMultiplyToNumber } from '../../../../util/bigint';
import { groupBy, omitUndefined } from '../../../../util/iteratees';
import { FEE_FACTOR } from '../constants';
import { fetchEmulateTrace } from '../toncenter/emulation';
import { toBase64Address, toRawAddress } from './tonCore';

export function parseEmulation(network: ApiNetwork, address: string, emulation: EmulationResponse): ApiEmulationResult {
  const rawAddress = toRawAddress(address).toUpperCase();

  const transactions = Object.entries(emulation.transactions)
    .map(([hash, rawTx]) => parseTransaction(network, hash, rawTx))
    .flat();

  const byHash = groupBy(transactions, 'hash');
  const byTransactionIndex: ApiEmulatedTransaction[] = [];

  function processTrace(trace: TraceDetail, _index?: number) {
    const txs = byHash[trace.tx_hash];

    for (const [i, { toAddress, amount, fee, isIncoming }] of txs.entries()) {
      const index = _index ?? i;

      if (!(index in byTransactionIndex)) {
        byTransactionIndex.push({
          received: 0n,
          fee: bigintMultiplyToNumber(fee, FEE_FACTOR),
        });
      }

      if (toAddress === rawAddress && isIncoming) {
        byTransactionIndex[index].received += bigintAbs(amount);
      }
    }

    for (const [i, children] of trace.children.entries()) {
      processTrace(children, _index ?? i);
    }
  }

  processTrace(emulation.trace);

  return {
    totalFee: byTransactionIndex.reduce((sum, { fee }) => sum + fee, 0n),
    totalReceived: byTransactionIndex.reduce((sum, { received }) => sum + received, 0n),
    byTransactionIndex,
  };
}

export function emulateTrace(network: ApiNetwork, wallet: TonWallet, body: Cell, isInitialized?: boolean) {
  const boc = buildExternalBoc(wallet, body, isInitialized);
  return fetchEmulateTrace(network, boc);
}

function parseTransaction(network: ApiNetwork, hash: string, rawTx: EmulationTransaction): ApiTransactionExtended[] {
  const {
    now,
    total_fees: totalFees,
    description: {
      compute_ph: {
        exit_code: exitCode,
      },
    },
  } = rawTx;

  const timestamp = now as number * 1000;
  const isIncoming = !!rawTx.in_msg.source;
  const inMsgHash = rawTx.in_msg.hash;
  const msgs: EmulationTransactionMessage[] = isIncoming ? [rawTx.in_msg] : rawTx.out_msgs;

  if (!msgs.length) return [];

  const oneMsgFee = BigInt(totalFees) / BigInt(msgs.length);

  const txs = msgs.map((msg, i) => {
    const {
      source,
      destination,
      value,
      fwd_fee: fwdFee,
      opcode,
      hash: msgHash,
    } = msg;
    const normalizedAddress = toBase64Address(isIncoming ? source! : destination, true, network);
    const fee = oneMsgFee + BigInt(fwdFee ?? 0);

    const tx: ApiTransactionExtended = omitUndefined({
      txId: msgs.length > 1 ? buildTxId(hash, i) : buildTxId(hash),
      timestamp,
      isIncoming,
      fromAddress: source!,
      toAddress: destination,
      amount: BigInt(value ?? 0),
      slug: TONCOIN.slug,
      fee,
      inMsgHash,
      normalizedAddress,
      shouldHide: exitCode ? true : undefined,
      hash,
      opCode: Number(opcode) || undefined,
      msgHash,
    });

    return tx;
  });

  return txs;
}

function buildExternalBoc(wallet: TonWallet, body: Cell, isInitialized?: boolean) {
  const externalMessage = external({
    to: wallet.address,
    init: !isInitialized ? {
      code: wallet.init.code,
      data: wallet.init.data,
    } : undefined,
    body,
  });

  return beginCell()
    .store(storeMessage(externalMessage))
    .endCell()
    .toBoc()
    .toString('base64');
}
