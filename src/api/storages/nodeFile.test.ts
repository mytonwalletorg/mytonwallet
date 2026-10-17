/* eslint-disable no-template-curly-in-string */
import { chmod, mkdir, open, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';

jest.mock('node:fs/promises', () => ({
  chmod: jest.fn(),
  mkdir: jest.fn(),
  open: jest.fn(),
  readFile: jest.fn(),
  rename: jest.fn(),
  rm: jest.fn(),
  stat: jest.fn(),
  writeFile: jest.fn(),
}));

import { createNodeFileStorage, resolveDefaultNodeFileStoragePath } from './nodeFile';

const chmodMock = jest.mocked(chmod);
const mkdirMock = jest.mocked(mkdir);
const openMock = jest.mocked(open);
const readFileMock = jest.mocked(readFile);
const renameMock = jest.mocked(rename);
const rmMock = jest.mocked(rm);
const statMock = jest.mocked(stat);
const writeFileMock = jest.mocked(writeFile);

function createFileHandle() {
  return {
    writeFile: jest.fn().mockResolvedValue(undefined),
    sync: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  };
}

describe('node-file storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    chmodMock.mockResolvedValue(undefined as never);
    mkdirMock.mockResolvedValue(undefined as never);
    openMock.mockImplementation(() => Promise.resolve(createFileHandle() as never));
    readFileMock.mockResolvedValue('{}' as never);
    renameMock.mockResolvedValue(undefined as never);
    rmMock.mockResolvedValue(undefined as never);
    writeFileMock.mockResolvedValue(undefined as never);
    statMock.mockResolvedValue({ mtimeMs: Date.now() } as never);
  });

  it('should use unique temp files for concurrent writes to the same storage path', async () => {
    const seenRenameSources = new Set<string>();

    renameMock.mockImplementation((sourcePath: any) => {
      if (seenRenameSources.has(String(sourcePath))) {
        const error = Object.assign(new Error(`ENOENT: missing temp file ${String(sourcePath)}`), {
          code: 'ENOENT',
        });

        return Promise.reject(error);
      }

      seenRenameSources.add(String(sourcePath));
      return Promise.resolve(undefined as never);
    });

    const storageA = createNodeFileStorage({ type: 'nodeFile', path: '/tmp/headless-storage.json' });
    const storageB = createNodeFileStorage({ type: 'nodeFile', path: '/tmp/headless-storage.json' });

    await expect(Promise.all([
      storageA.setItem('accounts', { a: 1 }),
      storageB.setItem('currentAccountId', 'ton-testnet-1'),
    ])).resolves.toEqual([undefined, undefined]);

    const renameSourcePaths = renameMock.mock.calls.map(([sourcePath]) => String(sourcePath));
    expect(new Set(renameSourcePaths).size).toBe(2);
    const tempPathPattern = /^\/tmp\/headless-storage\.json\..+\.tmp$/;
    expect(renameSourcePaths.every((sourcePath) => tempPathPattern.test(sourcePath))).toBe(true);
  });

  it('should flush the new contents before replacing the store and the directory after it', async () => {
    const fileHandle = createFileHandle();
    const dirHandle = createFileHandle();

    openMock.mockImplementation((targetPath: any) => Promise.resolve(
      (String(targetPath).endsWith('.tmp') ? fileHandle : dirHandle) as never,
    ));

    await createNodeFileStorage({ type: 'nodeFile', path: '/tmp/headless-storage.json' }).setItem('accounts', { a: 1 });

    expect(fileHandle.sync).toHaveBeenCalledTimes(1);
    expect(dirHandle.sync).toHaveBeenCalledTimes(1);
    expect(openMock).toHaveBeenCalledWith('/tmp', 'r');

    const [renameOrder] = renameMock.mock.invocationCallOrder;
    expect(fileHandle.sync.mock.invocationCallOrder[0]).toBeLessThan(renameOrder);
    expect(dirHandle.sync.mock.invocationCallOrder[0]).toBeGreaterThan(renameOrder);
  });

  it('should flush the parent of every newly created store directory before writing', async () => {
    const syncedPaths: string[] = [];

    mkdirMock.mockResolvedValueOnce(`${homedir()}/.mywallet` as never);
    openMock.mockImplementation((targetPath: any) => {
      const handle = createFileHandle();
      handle.sync.mockImplementation(() => {
        syncedPaths.push(String(targetPath));
        return Promise.resolve();
      });
      return Promise.resolve(handle as never);
    });

    await createNodeFileStorage({ type: 'nodeFile', profile: 'mywallet' }).setItem('accounts', { a: 1 });

    expect(syncedPaths).toEqual([
      `${homedir()}/.mywallet`,
      homedir(),
      expect.stringMatching(/\.tmp$/),
      `${homedir()}/.mywallet/mywallet`,
    ]);
  });

  it('should save into a new profile even when its parents cannot be synced', async () => {
    mkdirMock.mockResolvedValueOnce(`${homedir()}/.mywallet` as never);
    openMock.mockImplementation((targetPath: any) => (String(targetPath).endsWith('.tmp')
      ? Promise.resolve(createFileHandle() as never)
      : Promise.reject(Object.assign(new Error('EISDIR'), { code: 'EISDIR' }))));

    await createNodeFileStorage({ type: 'nodeFile', profile: 'mywallet' }).setItem('accounts', { a: 1 });

    expect(renameMock).toHaveBeenCalledTimes(1);
  });

  it('should remove the temp file when replacing the store fails', async () => {
    renameMock.mockRejectedValue(Object.assign(new Error('EXDEV'), { code: 'EXDEV' }));

    const storage = createNodeFileStorage({ type: 'nodeFile', path: '/tmp/headless-storage.json' });

    await expect(storage.setItem('accounts', { a: 1 })).rejects.toMatchObject({ code: 'EXDEV' });

    const [tempFilePath] = renameMock.mock.calls[0];
    expect(rmMock).toHaveBeenCalledWith(tempFilePath, { force: true });
  });

  it('should save even when the directory cannot be opened for syncing', async () => {
    openMock.mockImplementation((targetPath: any) => (String(targetPath).endsWith('.tmp')
      ? Promise.resolve(createFileHandle() as never)
      : Promise.reject(Object.assign(new Error('EISDIR'), { code: 'EISDIR' }))));

    const storage = createNodeFileStorage({ type: 'nodeFile', path: '/tmp/headless-storage.json' });

    await expect(storage.setItem('accounts', { a: 1 })).resolves.toBeUndefined();
    expect(renameMock).toHaveBeenCalledTimes(1);
  });

  it('should save even when the directory refuses to sync', async () => {
    const dirHandle = createFileHandle();

    dirHandle.sync.mockRejectedValue(Object.assign(new Error('EINVAL'), { code: 'EINVAL' }));
    openMock.mockImplementation((targetPath: any) => Promise.resolve(
      (String(targetPath).endsWith('.tmp') ? createFileHandle() : dirHandle) as never,
    ));

    const storage = createNodeFileStorage({ type: 'nodeFile', path: '/tmp/headless-storage.json' });

    await expect(storage.setItem('accounts', { a: 1 })).resolves.toBeUndefined();
    expect(dirHandle.close).toHaveBeenCalledTimes(1);
  });

  it('should save even when the directory handle fails to close', async () => {
    const dirHandle = createFileHandle();

    dirHandle.close.mockRejectedValue(Object.assign(new Error('EIO'), { code: 'EIO' }));
    openMock.mockImplementation((targetPath: any) => Promise.resolve(
      (String(targetPath).endsWith('.tmp') ? createFileHandle() : dirHandle) as never,
    ));

    const storage = createNodeFileStorage({ type: 'nodeFile', path: '/tmp/headless-storage.json' });

    await expect(storage.setItem('accounts', { a: 1 })).resolves.toBeUndefined();
  });

  it('should recover a stale per-storage lock before mutating', async () => {
    let mkdirCalls = 0;

    mkdirMock.mockImplementation((targetPath: any) => {
      if (String(targetPath).endsWith('.lock')) {
        mkdirCalls += 1;

        if (mkdirCalls === 1) {
          const error = Object.assign(new Error('EEXIST'), { code: 'EEXIST' });
          throw error;
        }
      }

      return undefined as never;
    });
    statMock.mockResolvedValue({ mtimeMs: Date.now() - 60_000 } as never);

    const storage = createNodeFileStorage({ type: 'nodeFile', path: '/tmp/headless-storage.json' });

    await storage.setItem('accounts', { a: 1 });

    expect(statMock).toHaveBeenCalledWith('/tmp/headless-storage.json.lock');
    expect(rmMock).toHaveBeenCalledWith('/tmp/headless-storage.json.lock', { recursive: true, force: true });
    expect(renameMock).toHaveBeenCalledTimes(1);
  });

  it('should fail with a clear error when the lock cannot be acquired in time', async () => {
    jest.useFakeTimers();

    mkdirMock.mockImplementation((targetPath: any) => {
      if (String(targetPath).endsWith('.lock')) {
        const error = Object.assign(new Error('EEXIST'), { code: 'EEXIST' });
        throw error;
      }

      return undefined as never;
    });

    const storage = createNodeFileStorage({ type: 'nodeFile', path: '/tmp/headless-storage.json' });
    const pendingWrite = storage.setItem('accounts', { a: 1 }).catch((err) => err);

    await jest.advanceTimersByTimeAsync(10_000);

    await expect(pendingWrite).resolves.toMatchObject({
      message: 'Timed out acquiring node-file storage lock for /tmp/headless-storage.json',
    });

    expect(renameMock).not.toHaveBeenCalled();

    jest.useRealTimers();
  });

  it('should resolve profile-backed storage into a durable home-directory path', async () => {
    const storage = createNodeFileStorage({ type: 'nodeFile', profile: 'mywallet' });

    await storage.getItem('accounts');

    expect(readFileMock).toHaveBeenCalledWith(resolveDefaultNodeFileStoragePath('mywallet'), 'utf8');
  });

  it('should expand ${HOME} placeholders in explicit storage paths', async () => {
    const storage = createNodeFileStorage({ type: 'nodeFile', path: '${HOME}/.mywallet/custom/storage.json' });

    await storage.getItem('accounts');

    expect(readFileMock).toHaveBeenCalledWith(`${homedir()}/.mywallet/custom/storage.json`, 'utf8');
  });

  it.each(['..', '.', '../Documents', 'nested/profile', 'nested\\profile'])(
    'should reject the profile %p that is not a plain directory name',
    (profile) => {
      expect(() => createNodeFileStorage({ type: 'nodeFile', profile })).toThrow('plain name');
      expect(() => resolveDefaultNodeFileStoragePath(profile)).toThrow('plain name');
    },
  );

  it('should restrict the profile directory to the owner', async () => {
    await createNodeFileStorage({ type: 'nodeFile', profile: 'mywallet' }).getItem('accounts');

    expect(chmodMock).toHaveBeenCalledWith(`${homedir()}/.mywallet/mywallet`, 0o700);
  });

  it('should leave the directory of an explicit storage path alone', async () => {
    await createNodeFileStorage({ type: 'nodeFile', path: '/tmp/headless-storage.json' }).getItem('accounts');

    expect(chmodMock).not.toHaveBeenCalledWith('/tmp', expect.anything());
    expect(chmodMock).toHaveBeenCalledWith('/tmp/headless-storage.json', 0o600);
  });

  it('should keep reading a store whose permissions cannot be changed', async () => {
    chmodMock.mockRejectedValue(Object.assign(new Error('EROFS'), { code: 'EROFS' }));
    readFileMock.mockResolvedValue('{"currentAccountId":"ton-1"}' as never);

    const storage = createNodeFileStorage({ type: 'nodeFile', profile: 'mywallet' });

    await expect(storage.getItem('currentAccountId')).resolves.toBe('ton-1');
  });
});
