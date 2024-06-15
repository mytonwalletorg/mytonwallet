import { BRILLIANT_API_BASE_URL } from '../../config';
import { fetchJson, handleFetchErrors } from '../../util/fetch';

const BAD_REQUEST_CODE = 400;

export async function callBackendPost<T>(path: string, data: AnyLiteral, options?: {
  authToken?: string;
  isAllowBadRequest?: boolean;
  method?: string;
}): Promise<T> {
  const { authToken, isAllowBadRequest, method } = options ?? {};

  const response = await fetch(`${BRILLIANT_API_BASE_URL}${path}`, {
    method: method ?? 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authToken && { 'X-Auth-Token': authToken }),
    },
    body: JSON.stringify(data),
  });

  await handleFetchErrors(response, isAllowBadRequest ? [BAD_REQUEST_CODE] : undefined);

  return response.json();
}

export function callBackendGet<T = any>(path: string, data?: AnyLiteral, headers?: HeadersInit): Promise<T> {
  const url = new URL(`${BRILLIANT_API_BASE_URL}${path}`);

  return fetchJson(url, data, { headers });
}
