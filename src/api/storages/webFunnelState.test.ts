/* eslint-disable no-null/no-null */
import { initializeWebClientState, readyWebLaunchState, settleWebLaunchState } from './webFunnelState';

const clientId = '0123456789abcdefabcd:';
const eventId = '4827b46b-7d3f-4b02-a97c-8f17f64095e7';
const visitId = '4b1ba9fc-3d32-438e-872a-f2ed83fb375b';
const context = { visitId, hasExistingState: false };
const now = 1791705630000;

it('creates one fresh lifecycle beside a new client ID and retains the original handoff across tabs', () => {
  const first = initializeWebClientState({}, clientId, context);
  expect(first.clientId).toBe(clientId);
  expect(first.webFirstLaunch).toEqual({ clientId: '0123456789abcdefabcd', phase: 'fresh', visitId });
  expect(initializeWebClientState(first, '22222222222222222222:', { ...context, visitId: null })).toEqual(first);
});

it.each([
  { clientId }, { accounts: {} }, { stateVersion: 1 }, { currentAccountId: '0-mainnet' },
  { legacyCoreAccountsConverted: true }, { installAttribution: {} },
  { referrer: 'alice' }, { attributionTechnicalClaimed: true },
])('does not classify prior installation evidence as fresh: %s', (saved) => {
  expect(initializeWebClientState(saved, clientId, context).webFirstLaunch).toBeUndefined();
});

it('excludes surviving UI cache and account hints even when SDK storage is empty', () => {
  expect(initializeWebClientState({}, clientId, { ...context, hasExistingState: true }).webFirstLaunch).toBeUndefined();
});

it('captures direct first launch only at ready and freezes the exact wire envelope', () => {
  const fresh = initializeWebClientState({}, clientId, { ...context, visitId: null });
  expect(fresh.webFirstLaunch?.event).toBeUndefined();
  const ready = readyWebLaunchState(fresh, now, eventId);
  expect(ready.webFirstLaunch?.event).toEqual({
    schemaVersion: 1, eventId, eventType: 'first_launch', visitorId: null, visitId: null,
    occurredAt: now, surface: 'web_app', attributionKind: 'direct', channel: '', referrerDomain: '',
    utmMedium: '', utmCampaign: '', utmContent: '',
  });
  expect(readyWebLaunchState(ready, now + 1000, visitId)).toEqual(ready);
});

it('matches ACK to client identity and event and keeps a terminal marker', () => {
  const pending = readyWebLaunchState(initializeWebClientState({}, clientId, context), now, eventId);
  expect(settleWebLaunchState(pending, 'wrong', eventId, 'delivered')).toEqual(pending);
  expect(settleWebLaunchState(pending, '0123456789abcdefabcd', visitId, 'delivered')).toEqual(pending);
  const replaced = { ...pending, clientId: '22222222222222222222:' };
  expect(settleWebLaunchState(replaced, '0123456789abcdefabcd', eventId, 'delivered')).toEqual(replaced);
  const delivered = settleWebLaunchState(pending, '0123456789abcdefabcd', eventId, 'delivered');
  expect(delivered.webFirstLaunch?.phase).toBe('delivered');
  expect(delivered.webFirstLaunch?.event).toBeUndefined();
  expect(readyWebLaunchState(delivered, now + 1000, visitId)).toEqual(delivered);
});
