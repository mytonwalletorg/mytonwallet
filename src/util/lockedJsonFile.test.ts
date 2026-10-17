import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createLockedJsonFileStore } from './lockedJsonFile';

const describeOnPosix = process.platform === 'win32' ? describe.skip : describe;

async function modeOf(path: string) {
  return ((await stat(path)).mode & 0o777).toString(8);
}

describeOnPosix('locked JSON file permissions', () => {
  let rootDir: string;
  let previousUmask: number;

  beforeEach(async () => {
    previousUmask = process.umask(0o022);
    rootDir = await mkdtemp(join(tmpdir(), 'mywallet-locked-json-'));
  });

  afterEach(async () => {
    process.umask(previousUmask);
    await rm(rootDir, { recursive: true, force: true });
  });

  it('should create the store, its directories and its lock accessible only to the owner', async () => {
    const filePath = join(rootDir, 'profile', 'nested', 'storage.json');
    const lockDirPath = `${filePath}.lock`;
    const store = createLockedJsonFileStore({ filePath });

    const lockModes = await store.mutate(async (data) => {
      data.accounts = { mnemonicEncrypted: 'ciphertext' };

      return [await modeOf(lockDirPath), await modeOf(join(lockDirPath, 'owner.json'))];
    });

    expect(lockModes).toEqual(['700', '600']);
    expect(await modeOf(join(rootDir, 'profile'))).toBe('700');
    expect(await modeOf(join(rootDir, 'profile', 'nested'))).toBe('700');
    expect(await modeOf(filePath)).toBe('600');
  });

  it('should restrict an existing store file on read and leave a directory it does not own alone', async () => {
    const dirPath = join(rootDir, 'shared');
    const filePath = join(dirPath, 'storage.json');

    await mkdir(dirPath, { mode: 0o755 });
    await writeFile(filePath, '{}', { mode: 0o644 });

    await createLockedJsonFileStore({ filePath }).read();

    expect(await modeOf(filePath)).toBe('600');
    expect(await modeOf(dirPath)).toBe('755');
  });

  it('should restrict an existing directory the store owns', async () => {
    const dirPath = join(rootDir, 'profile');
    const filePath = join(dirPath, 'storage.json');

    await mkdir(dirPath, { mode: 0o755 });
    await writeFile(filePath, '{}', { mode: 0o644 });

    await createLockedJsonFileStore({ filePath, ownsDirectory: true }).read();

    expect(await modeOf(dirPath)).toBe('700');
    expect(await modeOf(filePath)).toBe('600');
  });

  it('should keep reading a store that does not exist yet', async () => {
    const filePath = join(rootDir, 'missing', 'storage.json');

    await expect(createLockedJsonFileStore({ filePath, ownsDirectory: true }).read()).resolves.toEqual({});
  });
});
