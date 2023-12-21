import type { ApiSwapHistoryItem } from './backend';
import type { ApiTransaction } from './misc';

export type ApiTransactionActivity = ApiTransaction & {
  id: string;
  kind: 'transaction';
  shouldHide?: boolean;
};

export type ApiSwapActivity = ApiSwapHistoryItem & {
  kind: 'swap';
  shouldHide?: boolean;
};

export type ApiActivity = ApiTransactionActivity | ApiSwapActivity;
