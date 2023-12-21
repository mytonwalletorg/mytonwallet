import { TON_PROTOCOL, TONCONNECT_PROTOCOL, TONCONNECT_UNIVERSAL_URL } from '../../config';

export function parseTonDeeplink(value: string | unknown) {
  if (typeof value !== 'string' || !isTonDeeplink(value) || !value.includes('/transfer/')) {
    return undefined;
  }

  try {
    const url = new URL(value);
    return {
      to: url.pathname.replace(/.*\//, ''),
      amount: url.searchParams.get('amount') ?? undefined,
      comment: url.searchParams.get('text') ?? undefined,
    };
  } catch (err) {
    return undefined;
  }
}

export function isTonDeeplink(url: string) {
  return url.startsWith(TON_PROTOCOL);
}

export function isTonConnectDeeplink(url: string) {
  return url.startsWith(TONCONNECT_PROTOCOL) || url.startsWith(TONCONNECT_UNIVERSAL_URL);
}
