import type { WebFunnelContext } from '../../util/webFunnel';

export interface WebFirstLaunchEvent {
  schemaVersion: 1;
  eventId: string;
  eventType: 'first_launch';
  visitorId: null;
  visitId: string | null;
  occurredAt: number;
  surface: 'web_app';
  attributionKind: 'direct';
  channel: '';
  referrerDomain: '';
  utmMedium: '';
  utmCampaign: '';
  utmContent: '';
}

export interface WebFirstLaunchState {
  clientId: string;
  phase: 'fresh' | 'pending' | 'delivered' | 'expired' | 'rejected';
  visitId: string | null;
  event?: WebFirstLaunchEvent;
}

export interface WebFunnelStorageItems extends Record<string, unknown> {
  clientId?: string;
  referrer?: string;
  webFirstLaunch?: WebFirstLaunchState;
  webFunnelHandoff?: WebFunnelContext;
}

export const WEB_FUNNEL_STORAGE_KEYS = [
  'clientId', 'referrer', 'accounts', 'stateVersion', 'currentAccountId',
  'legacyCoreAccountsConverted', 'legacyCoreMigrationCompleted', 'installAttribution',
  'attributionClaimed', 'attributionChannel', 'attributionTechnicalClaimed', 'installMetadata',
  'webFirstLaunch', 'webFunnelHandoff',
] as const;

export function initializeWebClientState(
  saved: WebFunnelStorageItems, newClientId: string, context: WebFunnelContext,
): WebFunnelStorageItems {
  if (saved.clientId) return saved;
  const clientId = `${newClientId.split(':')[0]}:${saved.referrer ?? ''}`;
  const hasExistingState = context.hasExistingState || WEB_FUNNEL_STORAGE_KEYS.some((key) =>
    !['webFirstLaunch', 'webFunnelHandoff', 'clientId'].includes(key) && saved[key] !== undefined);
  const webFirstLaunch: WebFirstLaunchState | undefined = !hasExistingState && !saved.webFirstLaunch
    ? { clientId: clientId.split(':')[0], phase: 'fresh', visitId: context.visitId } : undefined;
  return { ...saved, clientId, webFirstLaunch };
}

export function readyWebLaunchState(
  saved: WebFunnelStorageItems, now: number, eventId: string,
): WebFunnelStorageItems {
  const state = saved.webFirstLaunch;
  if (state?.phase !== 'fresh' || saved.clientId?.split(':')[0] !== state.clientId) return saved;
  const event: WebFirstLaunchEvent = {
    // eslint-disable-next-line no-null/no-null
    schemaVersion: 1, eventId, eventType: 'first_launch', visitorId: null, visitId: state.visitId,
    occurredAt: now, surface: 'web_app', attributionKind: 'direct', channel: '', referrerDomain: '',
    utmMedium: '', utmCampaign: '', utmContent: '',
  };
  return { ...saved, webFirstLaunch: { ...state, phase: 'pending', event } };
}

export function settleWebLaunchState(
  saved: WebFunnelStorageItems, clientId: string, eventId: string,
  phase: 'delivered' | 'expired' | 'rejected',
): WebFunnelStorageItems {
  const state = saved.webFirstLaunch;
  if (state?.phase !== 'pending' || state.event?.eventId !== eventId || state.clientId !== clientId
    || saved.clientId?.split(':')[0] !== clientId) return saved;
  return { ...saved, webFirstLaunch: { clientId, phase, visitId: state.visitId } };
}
