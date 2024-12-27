import { callBackendPost } from '../../../common/backend';

const DIESEL_URL = '/diesel';

export function dieselSendBoc(boc: string) {
  return callBackendPost<{ result: string; paymentLink?: string }>(
    `${DIESEL_URL}/sendBoc`, { boc, isAddition: true }, { shouldRetry: true },
  );
}
