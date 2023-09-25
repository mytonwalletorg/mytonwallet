import { BRILLIANT_API_BASE_URL } from '../../config';
import { handleFetchErrors } from './utils';

const BAD_REQUEST_CODE = 400;

export async function callBackendPost(path: string, data: AnyLiteral, isAllowBadRequest?: boolean) {
  const response = await fetch(`${BRILLIANT_API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  handleFetchErrors(response, isAllowBadRequest ? [BAD_REQUEST_CODE] : undefined);
  return response.json();
}

export async function callBackendGet(path: string, data?: AnyLiteral, headers?: AnyLiteral) {
  const url = new URL(`${BRILLIANT_API_BASE_URL}${path}`);
  if (data) {
    Object.entries(data).forEach(([key, value]) => {
      url.searchParams.set(key, value.toString());
    });
  }

  const response = await fetch(url, { headers });
  handleFetchErrors(response);
  return response.json();
}
