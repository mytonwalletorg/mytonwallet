import { APP_VERSION, BRILLIANT_API_BASE_URL } from '../../config';
import { fetchJson, fetchWithRetry, handleFetchErrors } from '../../util/fetch';

const BAD_REQUEST_CODE = 400;

export async function callBackendPost<T>(path: string, data: AnyLiteral, options?: {
  authToken?: string;
  isAllowBadRequest?: boolean;
  method?: string;
  shouldRetry?: boolean;
  retries?: number;
  timeouts?: number | number[];
}): Promise<T> {
  const {
    authToken, isAllowBadRequest, method, shouldRetry, retries, timeouts,
  } = options ?? {};

  const url = new URL(`${BRILLIANT_API_BASE_URL}${path}`);

  const init: RequestInit = {
    method: method ?? 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authToken && { 'X-Auth-Token': authToken }),
      'X-App-Version': APP_VERSION,
    },
    body: JSON.stringify(data),
  };

  const response = shouldRetry
    ? await fetchWithRetry(url, init, {
      retries,
      timeouts,
      shouldSkipRetryFn: (message) => !message?.includes('signal is aborted'),
    })
    : await fetch(url.toString(), init);

  await handleFetchErrors(response, isAllowBadRequest ? [BAD_REQUEST_CODE] : undefined);

  return response.json();
}

export function callBackendGet<T = any>(path: string, data?: AnyLiteral, headers?: HeadersInit): Promise<T> {
  const url = new URL(`${BRILLIANT_API_BASE_URL}${path}`);

  return fetchJson(url, data, {
    headers: {
      ...headers,
      'X-App-Version': APP_VERSION,
    },
  });
}
