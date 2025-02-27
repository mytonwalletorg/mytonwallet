import type { Cell } from '@ton/core';
import { beginCell, external, storeMessage } from '@ton/core';

import type { ApiEmulationResult, ApiNetwork, ApiTransaction } from '../../../types';
import type { TonWallet } from './tonCore';

import { TONCENTER_MAINNET_URL, TONCENTER_TESTNET_URL, TONCOIN } from '../../../../config';
import { bigintAbs } from '../../../../util/bigint';
import { fetchWithRetry } from '../../../../util/fetch';
import { groupBy, omitUndefined } from '../../../../util/iteratees';
import { JettonOpCode, NftOpCode, ONE_TON } from '../constants';
import { stringifyTxId } from './index';
import { toBase64Address, toRawAddress } from './tonCore';

type Transaction = {
  account: string;
  lt: string;
  prev_trans_hash: string;
  prev_trans_lt: string;
  now: number;
  orig_status: string;
  end_status: string;
  in_msg: Message;
  out_msgs: Message[];
  total_fees: number;
  account_state_hash_before: string;
  account_state_hash_after: string;
  description: TransactionDescription;
};

type Message = {
  hash: string;
  source: string | null;
  destination: string;
  value: number | null;
  fwd_fee: number | null;
  ihr_fee: number | null;
  created_lt: string | null;
  created_at: number | null;
  opcode: string;
  ihr_disabled: boolean | null;
  bounce: boolean | null;
  bounced: boolean | null;
  import_fee: number | null;
  body_boc: string;
  init_state_boc: string | null;
};

type TransactionDescription = {
  credit_first: boolean;
  storage_ph: StoragePhase;
  credit_ph: CreditPhase | null;
  compute_ph: ComputePhase;
  action: ActionPhase | null;
  aborted: boolean;
  bounce: boolean | null;
  destroyed: boolean;
};

type StoragePhase = {
  storage_fees_collected: number;
  storage_fees_due: number | null;
  status_change: string;
};

type CreditPhase = {
  due_fees_collected: number | null;
  credit: number;
};

type ComputePhase = {
  account_activated?: boolean;
  exit_arg?: null;
  exit_code: number;
  gas_credit?: number | null;
  gas_fees: number;
  gas_limit: number;
  gas_used: number;
  mode: number;
  msg_state_used: boolean;
  skipped: boolean;
  success: boolean;
  vm_final_state_hash: string;
  vm_init_state_hash: string;
  vm_steps: number;
  reason?: string;
};

type ActionPhase = {
  success: boolean;
  valid: boolean;
  no_funds: boolean;
  status_change: string;
  total_fwd_fees: number | null;
  total_action_fees: number | null;
  result_code: number;
  result_arg: null;
  tot_actions: number;
  spec_actions: number;
  skipped_actions: number;
  msgs_created: number;
  action_list_hash: string;
  tot_msg_size: {
    cells: number;
    bits: number;
  };
};

type AccountState = {
  balance: number;
  account_status: string;
  frozen_hash: string | null;
  code_hash: string;
  data_hash: string;
  last_trans_hash: string;
  last_trans_lt: string;
  timestamp: number;
};

type Trace = {
  tx_hash: string;
  in_msg_hash: string;
  children: Trace[];
};

export type EmulationResponse = {
  mc_block_seqno: number;
  trace: Trace;
  transactions: {
    [key: string]: Transaction;
  };
  account_states: {
    [key: string]: AccountState;
  };
  rand_seed: string;
};

type ExtendedApiTransaction = ApiTransaction & {
  hash: string;
  opCode?: number;
};

const MAX_RECEIVED = ONE_TON;

export function parseEmulation(network: ApiNetwork, address: string, emulation: EmulationResponse): ApiEmulationResult {
  const rawAddress = toRawAddress(address).toUpperCase();

  const transactions = Object.entries(emulation.transactions)
    .map(([hash, rawTx]) => parseTransaction(network, hash, rawTx))
    .flat();

  const byHash = groupBy(transactions, 'hash');
  const byTransactionIndex: ApiEmulationResult['byTransactionIndex'] = [];

  function processTrace(trace: Trace, _index?: number) {
    const txs = byHash[trace.tx_hash];

    for (const [i, {
      fromAddress, toAddress, amount, fee, isIncoming, opCode,
    }] of txs.entries()) {
      const index = _index ?? i;

      if (!(index in byTransactionIndex)) {
        const isTokenOrNft = Boolean(
          opCode && [JettonOpCode.Transfer, NftOpCode.TransferOwnership].includes(opCode),
        );

        byTransactionIndex.push({
          sent: 0n,
          received: 0n,
          change: 0n,
          networkFee: fee,
          isTokenOrNft,
        });
      }

      if (fromAddress === rawAddress && !isIncoming) {
        byTransactionIndex[index].sent += amount;
        byTransactionIndex[index].change -= amount;
      } else if (toAddress === rawAddress && isIncoming) {
        byTransactionIndex[index].received += bigintAbs(amount);
        byTransactionIndex[index].change += amount;
      }
    }

    for (const [i, children] of trace.children.entries()) {
      processTrace(children, _index ?? i);
    }
  }

  processTrace(emulation.trace);

  let totalReceived = 0n;
  let totalNetworkFee = 0n;
  let totalRealFee: bigint | undefined = 0n;
  let totalChange = 0n;

  for (const emulated of byTransactionIndex) {
    const { change, received, isTokenOrNft } = emulated;

    const withRealFee = Boolean(
      isTokenOrNft
      && received > 0n
      && change < 0n
      && received < MAX_RECEIVED,
    );

    if (withRealFee) {
      emulated.realFee = bigintAbs(change) + emulated.networkFee;
      if (totalRealFee !== undefined) {
        totalRealFee += emulated.realFee;
      }
    } else {
      totalRealFee = undefined;
    }

    totalReceived += emulated.received;
    totalNetworkFee += emulated.networkFee;
    totalChange += emulated.change;
  }

  const emulationResult: ApiEmulationResult = {
    totalNetworkFee,
    totalRealFee,
    totalReceived,
    totalChange,
    byTransactionIndex,
  };

  return emulationResult;
}

export function emulateTrace(network: ApiNetwork, wallet: TonWallet, body: Cell, isInitialized?: boolean) {
  const boc = buildExternalBoc(wallet, body, isInitialized);
  return fetchEmulateTrace(network, boc);
}

function parseTransaction(
  network: ApiNetwork,
  hash: string,
  rawTx: Transaction,
): ExtendedApiTransaction[] {
  const {
    now,
    lt,
    total_fees: totalFees,
    description: {
      compute_ph: {
        exit_code: exitCode,
      },
    },
  } = rawTx;

  const txId = stringifyTxId({ lt, hash });
  const timestamp = now as number * 1000;
  const isIncoming = !!rawTx.in_msg.source;
  const inMsgHash = rawTx.in_msg.hash;
  const msgs: Message[] = isIncoming ? [rawTx.in_msg] : rawTx.out_msgs;

  if (!msgs.length) return [];

  const oneMsgFee = BigInt(totalFees) / BigInt(msgs.length);

  const txs = msgs.map((msg, i) => {
    const {
      source, destination, value, fwd_fee: fwdFee, opcode,
    } = msg;
    const normalizedAddress = toBase64Address(isIncoming ? source! : destination, true, network);
    const fee = oneMsgFee + BigInt(fwdFee ?? 0);

    const tx: ExtendedApiTransaction = omitUndefined({
      txId: msgs.length > 1 ? `${txId}:${i + 1}` : txId,
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

async function fetchEmulateTrace(network: ApiNetwork, boc: string): Promise<EmulationResponse> {
  const baseUrl = network === 'testnet' ? TONCENTER_TESTNET_URL : TONCENTER_MAINNET_URL;

  const response = await fetchWithRetry(`${baseUrl}/api/emulate/v1/emulateTrace`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      boc,
      ignore_chksig: true,
      include_code_data: false,
      with_actions: false,
    }),
  });

  return response.json();
}
