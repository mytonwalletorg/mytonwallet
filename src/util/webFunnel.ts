export interface WebFunnelContext {
  visitId: string | null;
  hasExistingState: boolean;
}

export const WEB_FUNNEL_QUERY = 'mw_visit_id';
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function getWebFunnelVisitId(search: string): string | null {
  const values = new URLSearchParams(search).getAll(WEB_FUNNEL_QUERY);
  // eslint-disable-next-line no-null/no-null
  return values.length === 1 && UUID_V4.test(values[0]) ? values[0] : null;
}

export function isWebFunnelOrigin(origin: string, isGram: boolean, env: string) {
  if (env === 'production') return origin === (isGram ? 'https://wallet.ton.org' : 'https://web.mywallet.io');
  if (env === 'staging') return !isGram && origin === 'https://web-beta.mywallet.io';
  return false;
}
