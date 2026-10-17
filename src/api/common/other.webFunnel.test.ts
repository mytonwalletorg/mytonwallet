/* eslint-disable no-null/no-null */
import type { WebFunnelStorageItems } from '../storages/webFunnelState';
import type { ApiInitArgs } from '../types';

import idb from '../storages/idb';
import { getClientId, initClientId, isWebFunnelClient } from './other';

let mockSaved: WebFunnelStorageItems;
let mockAllowed = true;
let mockWrites = Promise.resolve();
let mockSequence = 0;
jest.mock('../../util/webFunnel', () => ({ isWebFunnelOrigin: () => mockAllowed }));
jest.mock('../../util/random', () => ({ randomBytes: () => new Uint8Array(10).fill(++mockSequence) }));
jest.mock('../storages/idb', () => ({ __esModule: true, default: {} }));
jest.mock('../storages', () => ({ getCurrentStorage: () => jest.requireMock('../storages/idb').default, storage: {} }));
jest.mock('../storages/webFunnel', () => ({
  mutateWebFunnelStorage: (mutate: (saved: WebFunnelStorageItems) => WebFunnelStorageItems) => {
    const result = mockWrites.then(() => {
      mockSaved = mutate(mockSaved);
      return mockSaved;
    });
    mockWrites = result.then(() => {});
    return result;
  },
}));
const args: ApiInitArgs = { webFunnel: { visitId: null, hasExistingState: false } };
beforeEach(() => {
  mockSaved = {};
  mockAllowed = true;
});

it('uses atomic durable identity during concurrent init and rereads it after a storage clear', async () => {
  await Promise.all([initClientId(args), initClientId(args)]);
  const first = getClientId();
  expect(mockSaved.clientId).toBe(first);
  expect(mockSaved.webFirstLaunch?.clientId).toBe(first.split(':')[0]);
  mockSaved = {};
  await initClientId(args);
  expect(getClientId()).not.toBe(first);
  expect(mockSaved.clientId).toBe(getClientId());
});

it('retains old client identity and excludes UI account hints', async () => {
  mockSaved = { clientId: '0123456789abcdefabcd:' };
  await initClientId(args);
  expect(getClientId()).toBe('0123456789abcdefabcd:');
  expect(mockSaved.webFirstLaunch).toBeUndefined();
  mockSaved = {};
  await initClientId({ ...args, accountIds: ['0-mainnet'] });
  expect(mockSaved.webFirstLaunch).toBeUndefined();
});

it.each([{ isIosApp: true }, { isAndroidApp: true }, { isElectron: true }])(
  'rejects native init flags %s', (platform) => {
    expect(isWebFunnelClient({ ...args, ...platform }, idb)).toBe(false);
  },
);

it('requires canonical origin, protocol admission and actual IndexedDB runtime', () => {
  expect(isWebFunnelClient({}, idb)).toBe(false);
  expect(isWebFunnelClient(args, { ...idb })).toBe(false);
  mockAllowed = false;
  expect(isWebFunnelClient(args, idb)).toBe(false);
});
