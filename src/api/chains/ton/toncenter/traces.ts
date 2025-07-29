import type { ApiNetwork } from '../../../types';
import type { AddressBook, MetadataMap, Trace } from './types';

import { callToncenterV3 } from './other';

export type TracesResponse = {
  traces: Trace[];
  address_book: AddressBook;
  metadata: MetadataMap;
};

export async function fetchTrace(options: {
  network: ApiNetwork;
  msgHashNormalized: string;
  isActionPending?: boolean;
}): Promise<{
    trace?: Trace;
    addressBook: AddressBook;
    metadata: MetadataMap;
  }> {
  const { network, msgHashNormalized, isActionPending } = options;

  const response = await callToncenterV3<TracesResponse>(
    network,
    isActionPending ? '/pendingTraces' : '/traces',
    {
      [isActionPending ? 'ext_msg_hash' : 'msg_hash']: msgHashNormalized,
      include_actions: true,
    },
  );

  return {
    trace: response.traces[0],
    addressBook: response.address_book,
    metadata: response.metadata,
  };
}
