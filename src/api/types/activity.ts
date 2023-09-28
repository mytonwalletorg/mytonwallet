import type { ApiTransaction } from './misc';

export type ApiTransactionActivity = ApiTransaction & {
  id: string;
  kind: 'transaction';
};

export type ApiActivity = ApiTransactionActivity;
