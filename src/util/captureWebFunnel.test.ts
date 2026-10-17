/* eslint-disable no-null/no-null */
import { captureBrowserWebFunnel } from './captureWebFunnel';

let mockSaved: Record<string, any> = {};
let mockPersist = jest.fn();
let mockAllowed = true;
jest.mock('../config', () => ({
  ...jest.requireActual('../config'), APP_ENV: 'production', GLOBAL_STATE_CACHE_KEY: 'fixture-global-state',
}));
jest.mock('./windowEnvironment', () => ({ IS_ELECTRON: false }));
jest.mock('./webFunnel', () => ({
  ...jest.requireActual('./webFunnel'), isWebFunnelOrigin: () => mockAllowed,
}));
jest.mock('../api/storages/webFunnel', () => ({
  mutateWebFunnelStorage: async (mutate: (saved: Record<string, any>) => Record<string, any>) => {
    await mockPersist();
    mockSaved = mutate(mockSaved);
    return mockSaved;
  },
}));
const visitId = '4b1ba9fc-3d32-438e-872a-f2ed83fb375b';
beforeEach(() => {
  mockSaved = {};
  mockAllowed = true;
  mockPersist = jest.fn().mockResolvedValue(undefined);
  localStorage.clear();
  history.replaceState({ action: 'retained' }, '', `/?r=alice&mw_visit_id=${visitId}&utm_source=tc#action`);
});

it('removes only the handoff after durable capture and preserves referral, action and history state', async () => {
  let release!: () => void;
  mockPersist.mockImplementationOnce(() => new Promise<void>((resolve) => {
    release = resolve;
  }));
  const result = captureBrowserWebFunnel(false);
  expect(location.search).toContain('mw_visit_id');
  release();
  expect(await result).toEqual({ visitId, hasExistingState: false });
  expect(location.search).toBe('?r=alice&utm_source=tc');
  expect(location.hash).toBe('#action');
  expect(history.state).toEqual({ action: 'retained' });
});

it('retains initial unlinked handoff when later navigation brings a token', async () => {
  history.replaceState({}, '', '/');
  expect(await captureBrowserWebFunnel(false)).toEqual({ visitId: null, hasExistingState: false });
  history.replaceState({}, '', `/?mw_visit_id=${visitId}`);
  expect(await captureBrowserWebFunnel(false)).toEqual({ visitId: null, hasExistingState: false });
});

it('excludes surviving UI cache and account hints', async () => {
  localStorage.setItem('fixture-global-state', '{}');
  expect((await captureBrowserWebFunnel(false))?.hasExistingState).toBe(true);
  localStorage.clear();
  expect((await captureBrowserWebFunnel(true))?.hasExistingState).toBe(true);
});

it('does not erase handoff when persistence fails or use a disallowed origin', async () => {
  mockPersist.mockRejectedValueOnce(new Error('storage blocked'));
  expect(await captureBrowserWebFunnel(false)).toBeUndefined();
  expect(location.search).toContain('mw_visit_id');
  mockAllowed = false;
  expect(await captureBrowserWebFunnel(false)).toBeUndefined();
  expect(mockPersist).toHaveBeenCalledTimes(1);
});
