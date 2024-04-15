import {
  TON_PROTOCOL,
  TONCONNECT_PROTOCOL,
  TONCONNECT_PROTOCOL_SELF,
  TONCONNECT_UNIVERSAL_URL,
} from '../../config';

export function parseTonDeeplink(value: string | unknown) {
  if (typeof value !== 'string' || !isTonDeeplink(value) || !value.includes('/transfer/')) {
    return undefined;
  }

  try {
    const url = new URL(value);

    const to = url.pathname.replace(/.*\//, '');
    const amount = url.searchParams.get('amount') ?? undefined;
    const comment = url.searchParams.get('text') ?? undefined;
    const binPayload = url.searchParams.get('bin') ?? undefined;

    return {
      to,
      amount: amount ? BigInt(amount) : undefined,
      comment,
      binPayload,
    };
  } catch (err) {
    return undefined;
  }
}

export function isTonDeeplink(url: string) {
  return url.startsWith(TON_PROTOCOL);
}

export function isTonConnectDeeplink(url: string) {
  return url.startsWith(TONCONNECT_PROTOCOL)
    || url.startsWith(TONCONNECT_PROTOCOL_SELF)
    || url.startsWith(TONCONNECT_UNIVERSAL_URL);
}
