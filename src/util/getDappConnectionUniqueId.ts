import type { ApiDapp, ApiDappRequest } from '../api/types';

export function getDappConnectionUniqueId(request: ApiDappRequest | ApiDapp): string {
  return (request as any).sseOptions?.appClientId ?? (request as any).sse?.appClientId ?? 'jsbridge';
}
