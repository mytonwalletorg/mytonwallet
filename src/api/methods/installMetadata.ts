import type { Storage } from '../storages/types';

import { callBackendPost } from '../common/backend';

export interface InstallMetadata {
  installedAt: number;
  installVersion: string;
}

interface InstallMetadataState extends InstallMetadata {
  reported?: boolean;
}

export function normalizeInstallMetadata(value: unknown): InstallMetadata | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const { installedAt, installVersion } = value as InstallMetadata;
  if (!Number.isSafeInteger(installedAt) || installedAt <= 0 || installedAt % 1000 !== 0
    || typeof installVersion !== 'string' || installVersion.length > 64) return undefined;
  return { installedAt, installVersion };
}

let transitions: Promise<unknown> = Promise.resolve();
function transition<T>(action: () => Promise<T>): Promise<T> {
  const result = transitions.then(action, action);
  transitions = result.catch(() => {});
  return result;
}

async function readState(storage: Storage): Promise<InstallMetadataState | undefined> {
  const saved = await storage.getItem('installMetadata');
  const metadata = normalizeInstallMetadata(saved);
  return metadata ? { ...metadata, reported: saved.reported === true } : undefined;
}

const draining = new WeakMap<Storage, object>();

export async function reportInstallMetadata(storage: Storage) {
  if (draining.has(storage)) return;
  const operation = {};
  draining.set(storage, operation);
  let attempted: { installedAt: number; clientId: unknown } | undefined;
  try {
    while (true) {
      const selected = await transition(async () => {
        const state = await readState(storage);
        const clientId = await storage.getItem('clientId');
        if (!state || state.reported
          || (state.installedAt === attempted?.installedAt && clientId === attempted.clientId)) {
          draining.delete(storage);
          return undefined;
        }
        return { ...state, clientId };
      });
      if (!selected) return;
      attempted = selected;
      let accepted = false;
      try {
        const { installedAt, installVersion } = selected;
        accepted = (await callBackendPost<{ ok: boolean }>('/attribution/install', {
          installedAt, installVersion,
        }))?.ok === true;
      } catch { /* The persisted evidence is retried at the next initialization. */ }
      if (accepted) {
        await transition(async () => {
          const current = await readState(storage);
          if (current?.installedAt === selected.installedAt
            && await storage.getItem('clientId') === selected.clientId) {
            await storage.setItem('installMetadata', { ...current, reported: true });
          }
        });
      }
    }
  } catch { /* Metadata failure must not reject SDK initialization. */ } finally {
    if (draining.get(storage) === operation) draining.delete(storage);
  }
}

export async function acceptInstallMetadata(value: unknown, storage: Storage) {
  const metadata = normalizeInstallMetadata(value);
  if (!metadata) throw new Error('Invalid installation metadata');
  await transition(async () => {
    const saved = await readState(storage);
    if (saved?.installedAt !== metadata.installedAt) {
      await storage.setItem('installMetadata', metadata);
    }
  });
  void reportInstallMetadata(storage);
}
