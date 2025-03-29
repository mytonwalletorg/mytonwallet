import type { ApiNetwork } from '../../../types';
import type { TraceDetail } from './types';

import { TONCENTER_MAINNET_URL, TONCENTER_TESTNET_URL } from '../../../../config';
import { fetchWithRetry } from '../../../../util/fetch';

export type EmulationTransaction = {
  account: string;
  lt: string;
  prev_trans_hash: string;
  prev_trans_lt: string;
  now: number;
  orig_status: string;
  end_status: string;
  in_msg: EmulationTransactionMessage;
  out_msgs: EmulationTransactionMessage[];
  total_fees: number;
  account_state_hash_before: string;
  account_state_hash_after: string;
  description: {
    credit_first: boolean;
    storage_ph: {
      storage_fees_collected: number;
      storage_fees_due: number | null;
      status_change: string;
    };
    credit_ph: {
      due_fees_collected: number | null;
      credit: number;
    } | null;
    compute_ph: {
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
    action: {
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
    } | null;
    aborted: boolean;
    bounce: boolean | null;
    destroyed: boolean;
  };
};

export type EmulationTransactionMessage = {
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

export type EmulationResponse = {
  mc_block_seqno: number;
  trace: TraceDetail;
  transactions: Record<string, EmulationTransaction>;
  account_states: Record<string, AccountState>;
  rand_seed: string;
};

export async function fetchEmulateTrace(network: ApiNetwork, boc: string): Promise<EmulationResponse> {
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
