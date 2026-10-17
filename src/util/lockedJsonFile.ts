import { randomUUID } from 'node:crypto';
import { chmod, mkdir, open, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';

const LOCK_DIR_SUFFIX = '.lock';
const LOCK_METADATA_FILE_NAME = 'owner.json';
const LOCK_STALE_MS = 30_000;
const LOCK_RETRY_DELAY_MS = 50;
const LOCK_MAX_ATTEMPTS = 200;
const PRIVATE_DIR_MODE = 0o700;
const PRIVATE_FILE_MODE = 0o600;

interface LockedJsonFileStoreOptions {
  filePath: string;
  ownsDirectory?: boolean;
  replaceValue?(key: string, value: unknown): unknown;
  reviveValue?(key: string, value: unknown): unknown;
}

export interface LockedJsonFileStore<T extends Record<string, any>> {
  read(): Promise<T>;
  mutate<TResult>(callback: (data: T) => TResult | Promise<TResult>): Promise<TResult>;
}

export function createLockedJsonFileStore<T extends Record<string, any>>(
  options: LockedJsonFileStoreOptions,
): LockedJsonFileStore<T> {
  let operationPromise = Promise.resolve();
  let restrictPromise: Promise<void> | undefined;

  return {
    async read() {
      await restrictExistingPermissions();
      return readJsonFile<T>(options.filePath, options.reviveValue);
    },
    mutate<TResult>(callback: (data: T) => TResult | Promise<TResult>) {
      return enqueueOperation(async () => {
        await restrictExistingPermissions();
        const releaseLock = await acquireFileLock(options.filePath);

        try {
          const data = await readJsonFile<T>(options.filePath, options.reviveValue);
          const result = await callback(data);

          await writeJsonFile(options.filePath, data, options.replaceValue);

          return result;
        } finally {
          await releaseLock();
        }
      });
    },
  };

  function enqueueOperation<TResult>(callback: () => Promise<TResult>) {
    const nextPromise = operationPromise.then(callback, callback);

    operationPromise = nextPromise.then(() => undefined, () => undefined);

    return nextPromise;
  }

  function restrictExistingPermissions() {
    restrictPromise ??= restrictPermissions(options);
    return restrictPromise;
  }
}

async function restrictPermissions({ filePath, ownsDirectory }: LockedJsonFileStoreOptions) {
  if (ownsDirectory) {
    await restrictMode(dirnamePath(filePath), PRIVATE_DIR_MODE);
  }

  await restrictMode(filePath, PRIVATE_FILE_MODE);
}

async function restrictMode(path: string, mode: number) {
  // Best effort: a missing path is created private later, and a foreign or read-only one must stay usable.
  await chmod(path, mode).catch(() => undefined);
}

async function acquireFileLock(filePath: string) {
  const lockDirPath = `${filePath}${LOCK_DIR_SUFFIX}`;
  const lockMetadata = JSON.stringify({
    pid: process.pid,
    createdAt: Date.now(),
  });

  await createStoreDirectory(dirnamePath(filePath));

  for (let attempt = 1; attempt <= LOCK_MAX_ATTEMPTS; attempt += 1) {
    try {
      await mkdir(lockDirPath, { mode: PRIVATE_DIR_MODE });
      await writeFile(joinFilePath(lockDirPath, LOCK_METADATA_FILE_NAME), lockMetadata, {
        encoding: 'utf8',
        mode: PRIVATE_FILE_MODE,
      });

      return async () => {
        try {
          await rm(lockDirPath, { recursive: true, force: true });
        } catch (err: any) {
          if (err?.code !== 'ENOENT') {
            throw err;
          }
        }
      };
    } catch (err: any) {
      if (err?.code !== 'EEXIST') {
        throw err;
      }

      if (await isStaleLock(lockDirPath)) {
        await rm(lockDirPath, { recursive: true, force: true });
        continue;
      }

      if (attempt === LOCK_MAX_ATTEMPTS) {
        throw new Error(`Timed out acquiring node-file storage lock for ${filePath}`);
      }

      await wait(LOCK_RETRY_DELAY_MS);
    }
  }

  throw new Error(`Failed to acquire node-file storage lock for ${filePath}`);
}

async function isStaleLock(lockDirPath: string) {
  try {
    const lockStat = await stat(lockDirPath);
    return Date.now() - lockStat.mtimeMs >= LOCK_STALE_MS;
  } catch (err: any) {
    if (err?.code === 'ENOENT') {
      return false;
    }

    throw err;
  }
}

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function readJsonFile<T extends Record<string, any>>(
  filePath: string,
  reviveValue?: (key: string, value: unknown) => unknown,
): Promise<T> {
  try {
    const content = await readFile(filePath, 'utf8');
    return JSON.parse(content, reviveValue) as T;
  } catch (err: any) {
    if (err?.code === 'ENOENT') {
      return {} as T;
    }

    throw err;
  }
}

async function writeJsonFile(
  filePath: string,
  data: Record<string, any>,
  replaceValue?: (key: string, value: unknown) => unknown,
) {
  const dirPath = dirnamePath(filePath);

  await createStoreDirectory(dirPath);

  const tempFilePath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  const content = JSON.stringify(data, replaceValue);

  try {
    await writeSyncedFile(tempFilePath, content);
    await rename(tempFilePath, filePath);
  } catch (err) {
    await rm(tempFilePath, { force: true }).catch(() => undefined);
    throw err;
  }

  // Best effort: the rename has already happened, and some systems refuse to open or sync a directory.
  await syncDirectory(dirPath).catch(() => undefined);
}

async function createStoreDirectory(dirPath: string) {
  const firstCreatedPath = await mkdir(dirPath, { recursive: true, mode: PRIVATE_DIR_MODE });

  if (!firstCreatedPath) {
    return;
  }

  // A new directory survives a power loss only once the directory holding its entry is synced.
  for (let path = dirPath; path !== dirnamePath(path); path = dirnamePath(path)) {
    await syncDirectory(dirnamePath(path)).catch(() => undefined);

    if (path === firstCreatedPath) {
      break;
    }
  }
}

async function writeSyncedFile(filePath: string, content: string) {
  const handle = await open(filePath, 'wx', PRIVATE_FILE_MODE);

  try {
    await handle.writeFile(content, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function syncDirectory(dirPath: string) {
  const handle = await open(dirPath, 'r');

  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

function joinFilePath(...parts: string[]) {
  const separator = parts.some((part) => part.includes('\\')) ? '\\' : '/';
  const [firstPart = '', ...restParts] = parts.filter(Boolean);

  if (!firstPart) {
    return '';
  }

  const normalizedFirstPart = firstPart === '/' || firstPart === '\\'
    ? firstPart
    : firstPart.replace(/[\\/]+$/, '');
  const normalizedRestParts = restParts
    .map((part) => part.replace(/^[\\/]+|[\\/]+$/g, ''))
    .filter(Boolean);

  if (!normalizedRestParts.length) {
    return normalizedFirstPart;
  }

  const base = normalizedFirstPart.endsWith(separator)
    ? normalizedFirstPart.slice(0, -1)
    : normalizedFirstPart;

  return `${base}${separator}${normalizedRestParts.join(separator)}`;
}

function dirnamePath(filePath: string) {
  const normalizedPath = filePath.replace(/[\\/]+$/, '');
  const lastSeparatorIndex = Math.max(normalizedPath.lastIndexOf('/'), normalizedPath.lastIndexOf('\\'));

  if (lastSeparatorIndex < 0) {
    return '.';
  }

  if (lastSeparatorIndex === 0) {
    return normalizedPath[0];
  }

  if (lastSeparatorIndex === 2 && normalizedPath[1] === ':') {
    return normalizedPath.slice(0, 3);
  }

  return normalizedPath.slice(0, lastSeparatorIndex);
}
