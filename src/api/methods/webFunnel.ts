import type { Storage } from '../storages/types';
import type { WebFirstLaunchEvent } from '../storages/webFunnelState';

import { BRILLIANT_API_BASE_URL } from '../../config';
import { getBackendHeaders } from '../common/backend';
import idb from '../storages/idb';
import { mutateWebFunnelStorage } from '../storages/webFunnel';
import { readyWebLaunchState, settleWebLaunchState } from '../storages/webFunnelState';

const RETENTION_MS = 30 * 86400000;
const RETRY_DELAYS = [1000, 5000, 30000, 300000];
const inFlight = new WeakSet<Storage>();
let activeStorage: Storage | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
let attempt = 0;

export async function reportWebFirstLaunch(storage: Storage): Promise<boolean> {
  if (storage !== idb || inFlight.has(storage)) return false;
  inFlight.add(storage);
  try {
    const saved = await mutateWebFunnelStorage((items) => items);
    const state = saved.webFirstLaunch;
    const event = state?.event;
    if (state?.phase !== 'pending' || !event || saved.clientId?.split(':')[0] !== state.clientId) return false;
    if (Date.now() - event.occurredAt >= RETENTION_MS) {
      await mutateWebFunnelStorage((items) => settleWebLaunchState(items, state.clientId, event.eventId, 'expired'));
      return false;
    }
    const headers = getBackendHeaders();
    if (headers['X-App-ClientID']?.split(':')[0] !== state.clientId) return false;
    const phase = await sendWebFirstLaunch(event, headers);
    if (phase) {
      await mutateWebFunnelStorage((items) => settleWebLaunchState(items, state.clientId, event.eventId, phase));
      return false;
    }
    return true;
  } catch {
    return true;
  } finally {
    inFlight.delete(storage);
  }
}

export async function startWebFirstLaunchReporting(storage: Storage, isReady: () => boolean) {
  const occurredAt = Date.now();
  try {
    if (storage !== idb) return;
    await mutateWebFunnelStorage((items) => isReady()
      ? readyWebLaunchState(items, occurredAt, crypto.randomUUID()) : items);
    if (!isReady()) return;
    activeStorage = storage;
    attempt = 0;
    await retryWebFirstLaunch();
  } catch { /* Collection failure must not reject SDK initialization. */ }
}

export async function retryWebFirstLaunch() {
  const storage = activeStorage;
  if (!storage || inFlight.has(storage)) return;
  clearTimeout(timer);
  if (await reportWebFirstLaunch(storage) && activeStorage === storage) {
    const delay = RETRY_DELAYS[Math.min(attempt++, RETRY_DELAYS.length - 1)];
    timer = setTimeout(() => {
      void retryWebFirstLaunch();
    }, delay);
  }
}

export function stopWebFirstLaunchReporting() {
  clearTimeout(timer);
  activeStorage = undefined;
}

async function sendWebFirstLaunch(event: WebFirstLaunchEvent, headers: Record<string, string>) {
  const controller = new AbortController();
  let deadline: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<never>((_resolve, reject) => {
    deadline = setTimeout(() => {
      controller.abort();
      reject(new Error('Web funnel acknowledgement timed out'));
    }, 10000);
  });
  try {
    return await Promise.race([(async () => {
      const response = await fetch(`${BRILLIANT_API_BASE_URL}/attribution/web-funnel`, {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(event), signal: controller.signal,
      });
      if (response.status === 400) return 'rejected' as const;
      if (response.status !== 200) return undefined;
      const result = await response.json();
      return result?.ok === true && result.eventId === event.eventId ? 'delivered' as const : undefined;
    })(), timedOut]);
  } finally {
    clearTimeout(deadline);
    controller.abort();
  }
}
