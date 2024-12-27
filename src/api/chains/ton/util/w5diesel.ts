import { callBackendPost } from '../../../common/backend';

const DIESEL_URL = '/diesel';

export function dieselW5SendRequest(boc: string) {
  return callBackendPost<{ result: string; paymentLink?: string }>(
    `${DIESEL_URL}/w5/sendBoc`, { boc, isAddition: true }, { shouldRetry: true },
  );
}
