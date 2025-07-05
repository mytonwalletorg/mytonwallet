import type { ApiSwapDexLabel, ApiSwapHistoryItem } from './backend';
import type { ApiNftMarketplace, ApiTransaction } from './misc';

type BaseActivity = {
  id: string;
  shouldHide?: boolean;
  externalMsgHash?: string; // Only for TON
  /** Whether more details should be loaded by calling the `fetchTonActivityDetails` action. Undefined means "no". */
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
