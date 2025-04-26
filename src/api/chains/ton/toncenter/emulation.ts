import type { ApiNetwork } from '../../../types';
import type { AccountState, AddressBook, AnyAction, MetadataMap, TraceDetail, Transaction } from './types';

import { TONCENTER_MAINNET_URL, TONCENTER_TESTNET_URL } from '../../../../config';
import { fetchWithRetry } from '../../../../util/fetch';

export type EmulationResponse = {
  mc_block_seqno: number;
  trace: TraceDetail;
  actions: AnyAction[];
  transactions: Record<string, Transaction>;
  account_states: Record<string, AccountState>;
  rand_seed: string;
  metadata: MetadataMap;
  address_book: AddressBook;
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
      with_actions: true,
      include_address_book: true,
      include_metadata: true,
    }),
  });

  return response.json();
}
