import { callBackendPost } from '../../../common/backend';

const DIESEL_URL = '/diesel';

export function dieselSendBoc(boc: string) {
  return callBackendPost(`${DIESEL_URL}/sendBoc`, { boc });
}
