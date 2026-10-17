import type { Storage } from '../storages/types';

import { acceptInstallMetadata, reportInstallMetadata } from './installMetadata';

const mockPost = jest.fn();
jest.mock('../common/backend', () => ({ callBackendPost: (...args: unknown[]) => mockPost(...args) }));

const evidence = { installedAt: 1788220800000, installVersion: '26.8.9' };

function makeStorage(seed: Record<string, unknown> = {}) {
  const values = new Map(Object.entries(seed));
  const storage: Storage = {
    getItem: (key) => Promise.resolve(values.get(key)),
    setItem: (key, value) => {
      values.set(key, value);
      return Promise.resolve();
    },
    removeItem: (key) => {
      values.delete(key);
      return Promise.resolve();
    },
    clear: () => {
      values.clear();
      return Promise.resolve();
    },
  };
  return { storage, values };
}

async function settle() {
  for (let i = 0; i < 40; i++) await Promise.resolve();
}

beforeEach(() => {
  mockPost.mockReset().mockResolvedValue({ ok: true });
});

it('reports a previously claimed installation and persists before transport', async () => {
  const { storage, values } = makeStorage({ attributionClaimed: '1', attributionChannel: 'organic' });
  mockPost.mockImplementation(() => {
    expect(values.get('installMetadata')).toEqual(evidence);
    return Promise.resolve({ ok: true });
  });
  await acceptInstallMetadata(evidence, storage);
  await settle();
  expect(mockPost).toHaveBeenCalledTimes(1);
  expect(mockPost).toHaveBeenCalledWith('/attribution/install', evidence);
  expect(values.get('installMetadata')).toEqual({ ...evidence, reported: true });
  expect(values.get('attributionClaimed')).toBe('1');
  expect(values.get('attributionChannel')).toBe('organic');
});

it.each([false, 'true', undefined])('only acknowledges a literal ok:true response (received %s)', async (ok) => {
  const { storage, values } = makeStorage();
  mockPost.mockResolvedValueOnce({ ok });
  await acceptInstallMetadata(evidence, storage);
  await settle();
  expect(values.get('installMetadata')).toEqual(evidence);
  await reportInstallMetadata(storage);
  expect(mockPost).toHaveBeenCalledTimes(2);
  expect(values.get('installMetadata')).toEqual({ ...evidence, reported: true });
});

it('retains failed delivery for a later initialization and never changes the retry payload', async () => {
  const { storage, values } = makeStorage();
  mockPost.mockRejectedValueOnce(new Error('offline'));
  await acceptInstallMetadata(evidence, storage);
  await settle();
  expect(mockPost).toHaveBeenCalledTimes(1);
  expect(values.get('installMetadata')).toEqual(evidence);
  await reportInstallMetadata(storage);
  await acceptInstallMetadata({ ...evidence, installVersion: '26.10.5' }, storage);
  await settle();
  expect(mockPost.mock.calls).toEqual([
    ['/attribution/install', evidence], ['/attribution/install', evidence],
  ]);
  expect(values.get('installMetadata')).toEqual({ ...evidence, reported: true });
});

it('deduplicates overlapping initialization and native deliveries', async () => {
  const { storage } = makeStorage({ installMetadata: evidence });
  let complete!: (value: { ok: boolean }) => void;
  mockPost.mockImplementationOnce(() => new Promise((resolve) => {
    complete = resolve;
  }));
  const reporting = reportInstallMetadata(storage);
  await Promise.all([acceptInstallMetadata(evidence, storage), reportInstallMetadata(storage)]);
  await settle();
  expect(mockPost).toHaveBeenCalledTimes(1);
  complete({ ok: true });
  await reporting;
  await reportInstallMetadata(storage);
  expect(mockPost).toHaveBeenCalledTimes(1);
});

it('does not restore acknowledged evidence after storage is wiped', async () => {
  const { storage, values } = makeStorage({ installMetadata: evidence });
  let complete!: (value: { ok: boolean }) => void;
  mockPost.mockImplementationOnce(() => new Promise((resolve) => {
    complete = resolve;
  }));
  const reporting = reportInstallMetadata(storage);
  await settle();
  await storage.clear();
  complete({ ok: true });
  await reporting;
  expect(values.size).toBe(0);
  await acceptInstallMetadata(evidence, storage);
  await settle();
  expect(mockPost).toHaveBeenCalledTimes(2);
});

it('reports a changed installation timestamp without acknowledging it with the older response', async () => {
  const { storage, values } = makeStorage({ installMetadata: evidence });
  let complete!: (value: { ok: boolean }) => void;
  mockPost.mockImplementationOnce(() => new Promise((resolve) => {
    complete = resolve;
  }));
  const reporting = reportInstallMetadata(storage);
  await settle();
  const next = { installedAt: 1788307200000, installVersion: '' };
  await acceptInstallMetadata(next, storage);
  complete({ ok: true });
  await reporting;
  expect(mockPost.mock.calls).toEqual([['/attribution/install', evidence], ['/attribution/install', next]]);
  expect(values.get('installMetadata')).toEqual({ ...next, reported: true });
});

it('reports the same Play timestamp again when a wipe creates a new clientId during delivery', async () => {
  const { storage, values } = makeStorage({ clientId: 'old', installMetadata: evidence });
  let complete!: (value: { ok: boolean }) => void;
  mockPost.mockImplementationOnce(() => new Promise((resolve) => {
    complete = resolve;
  }));
  const reporting = reportInstallMetadata(storage);
  await settle();
  await storage.clear();
  await storage.setItem('clientId', 'new');
  await acceptInstallMetadata(evidence, storage);
  complete({ ok: true });
  await reporting;
  expect(mockPost).toHaveBeenCalledTimes(2);
  expect(values.get('installMetadata')).toEqual({ ...evidence, reported: true });
});

it.each([
  { installedAt: 0, installVersion: '' },
  { installedAt: -1000, installVersion: '' },
  { installedAt: 1788220800001, installVersion: '' },
  { installedAt: Number.MAX_SAFE_INTEGER + 1, installVersion: '' },
  { installedAt: 1788220800000, installVersion: 'a'.repeat(65) },
  { installedAt: '1788220800000', installVersion: '' },
  { installedAt: 1788220800000 },
  undefined,
])('drops invalid native and stored evidence: %p', async (candidate) => {
  const { storage, values } = makeStorage();
  await expect(acceptInstallMetadata(candidate, storage)).rejects.toThrow();
  expect(values.size).toBe(0);
  values.set('installMetadata', candidate);
  await reportInstallMetadata(storage);
  expect(mockPost).not.toHaveBeenCalled();
});

it('keeps transport silent when persisting evidence fails', async () => {
  const { storage } = makeStorage();
  storage.setItem = () => Promise.reject(new Error('disk unavailable'));
  await expect(acceptInstallMetadata(evidence, storage)).rejects.toThrow('disk unavailable');
  await settle();
  expect(mockPost).not.toHaveBeenCalled();
});
