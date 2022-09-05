import { ApiTransaction } from '../../types';

type ApiRequiredFields = 'fromAddress' | 'toAddress' | 'comment' | 'isIncoming';

export type AnyTransaction = Omit<ApiTransaction, ApiRequiredFields> & Partial<Pick<ApiTransaction, ApiRequiredFields>>;

export interface ApiTransactionWithLt extends ApiTransaction {
  lt: number;
}

export interface AnyTransactionWithLt extends AnyTransaction {
  lt: number;
}
