import type { Storage } from '../../storages/types';

const mockValues = new Map<string, unknown>();
const mockStorage: Storage = {
  getItem: (key) => Promise.resolve(mockValues.get(key)),
  setItem: (key, value) => {
    mockValues.set(key, value);
    return Promise.resolve();
  },
  removeItem: (key) => {
    mockValues.delete(key);
    return Promise.resolve();
  },
  clear: () => {
    mockValues.clear();
    return Promise.resolve();
  },
};
const mockPost = jest.fn();
const mockInit = jest.fn();
const mockTechnicalClaim = jest.fn();
jest.mock('../../common/backend', () => ({ callBackendPost: (...args: unknown[]) => mockPost(...args) }));
jest.mock('../../storages', () => ({
  createStorage: () => mockStorage, withStorage: (_: unknown, action: () => unknown) => action(),
}));
jest.mock('../../methods/init', () => ({ __esModule: true, default: (...args: unknown[]) => mockInit(...args) }));
jest.mock('../../methods/attribution', () => ({
  acceptInstallAttribution: jest.fn(),
  setInstallChannel: (...args: unknown[]) => mockTechnicalClaim(...args),
}));
jest.mock('../../methods/registry', () => ({ methods: {} }));
jest.mock('../../dappProtocols', () => ({ getProtocolManager: jest.fn() }));

let createDirectApiConnector: typeof import('./connector').createDirectApiConnector;
beforeAll(async () => {
  ({ createDirectApiConnector } = await import('./connector'));
});

const evidence = { installedAt: 1788220800000, installVersion: '26.8.9' };
async function settle() {
  for (let i = 0; i < 60; i++) await Promise.resolve();
}

beforeEach(() => {
  mockValues.clear();
  mockPost.mockReset().mockResolvedValue({ ok: true });
  mockInit.mockReset().mockResolvedValue(undefined);
  mockTechnicalClaim.mockReset().mockResolvedValue(undefined);
});

it('captures metadata before initialization and sends after readiness despite an in-flight source claim', async () => {
  let ready!: () => void;
  let releaseClaim!: () => void;
  mockInit.mockImplementationOnce(() => new Promise<void>((resolve) => {
    ready = resolve;
  }));
  mockTechnicalClaim.mockImplementationOnce(() => new Promise<void>((resolve) => {
    releaseClaim = resolve;
  }));
  const connector = createDirectApiConnector();
  connector.captureInstallMetadata(evidence);
  connector.setInstallChannel('organic');
  connector.initApi(jest.fn(), {});
  await settle();
  expect(mockValues.size).toBe(0);
  expect(mockPost).not.toHaveBeenCalled();
  ready();
  await settle();
  expect(mockPost).toHaveBeenCalledWith('/attribution/install', evidence);
  expect(mockValues.get('installMetadata')).toEqual({ ...evidence, reported: true });
  releaseClaim();
  await settle();
});

it('retains metadata through failed initialization, rejects invalid data and snapshots the input', async () => {
  mockInit.mockRejectedValueOnce(new Error('initialization failed'));
  const connector = createDirectApiConnector();
  connector.captureInstallMetadata({ installedAt: 0, installVersion: '' });
  const candidate = { ...evidence };
  connector.captureInstallMetadata(candidate);
  candidate.installedAt = 1;
  connector.initApi(jest.fn(), {});
  await settle();
  expect(mockPost).not.toHaveBeenCalled();
  connector.initApi(jest.fn(), {});
  await settle();
  expect(mockPost).toHaveBeenCalledTimes(1);
  expect(mockPost).toHaveBeenCalledWith('/attribution/install', evidence);
});

it('lets replacement initialization deliver once while the prior initialization remains unresolved', async () => {
  let ready!: () => void;
  mockInit.mockImplementationOnce(() => new Promise<void>((resolve) => {
    ready = resolve;
  }));
  const connector = createDirectApiConnector();
  connector.initApi(jest.fn(), {});
  connector.captureInstallMetadata(evidence);
  connector.initApi(jest.fn(), {});
  await settle();
  expect(mockPost).toHaveBeenCalledTimes(1);
  ready();
  await settle();
  expect(mockPost).toHaveBeenCalledTimes(1);
});

it('keeps failed storage acceptance queued for the next initialization without a retry loop', async () => {
  const persist = jest.spyOn(mockStorage, 'setItem').mockRejectedValueOnce(new Error('storage unavailable'));
  const connector = createDirectApiConnector();
  connector.captureInstallMetadata(evidence);
  connector.initApi(jest.fn(), {});
  await settle();
  expect(persist).toHaveBeenCalledTimes(1);
  expect(mockPost).not.toHaveBeenCalled();
  connector.initApi(jest.fn(), {});
  await settle();
  expect(mockPost).toHaveBeenCalledTimes(1);
  expect(mockValues.get('installMetadata')).toEqual({ ...evidence, reported: true });
  persist.mockRestore();
});
