import type { ApiSwapDexLabel, ApiSwapHistoryItem } from './backend';
import type { ApiNftMarketplace, ApiTransaction } from './misc';

type BaseActivity = {
  id: string;
  shouldHide?: boolean;
  /** Trace external message hash normalized. Only for TON. */
  externalMsgHashNorm?: string;
  /** Whether the activity data should be re-loaded to get the necessary data before showing in the activity list */
  shouldReload?: boolean;
  /**
   * Whether more details should be loaded by calling the `fetchTonActivityDetails` action when the activity modal is
   * open. Undefined means "no".
   */
  shouldLoadDetails?: boolean;
  extra?: {
    withW5Gasless?: boolean; // Only for TON
    dex?: ApiSwapDexLabel; // Only for TON liquidity deposit and withdrawal
    marketplace?: ApiNftMarketplace;
    // TODO Move other extra fields here (externalMsgHash, ...)
  };
};

export type ApiTransactionActivity = BaseActivity & ApiTransaction & {
  kind: 'transaction';
};

export type ApiSwapActivity = BaseActivity & ApiSwapHistoryItem & {
  kind: 'swap';
};

export type ApiActivity = ApiTransactionActivity | ApiSwapActivity;
