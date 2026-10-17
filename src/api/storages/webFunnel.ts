import { promisifyRequest } from 'idb-keyval';

import type { WebFunnelStorageItems } from './webFunnelState';

import { store } from './idb';
import { WEB_FUNNEL_STORAGE_KEYS } from './webFunnelState';

export function mutateWebFunnelStorage(
  mutate: (saved: WebFunnelStorageItems) => WebFunnelStorageItems,
): Promise<WebFunnelStorageItems> {
  return store('readwrite', (objectStore) => {
    const completed = promisifyRequest(objectStore.transaction);
    void completed.catch(() => {});
    return Promise.all(WEB_FUNNEL_STORAGE_KEYS.map((key) => promisifyRequest(objectStore.get(key))))
      .then(async (values) => {
        const saved = Object.fromEntries(WEB_FUNNEL_STORAGE_KEYS.map((key, index) => [key, values[index]]));
        let next: WebFunnelStorageItems;
        try {
          next = mutate(saved);
          for (const key of ['clientId', 'webFirstLaunch', 'webFunnelHandoff'] as const) {
            if (next[key] === saved[key]) continue;
            if (next[key] === undefined) objectStore.delete(key);
            else objectStore.put(next[key], key);
          }
        } catch (error) {
          objectStore.transaction.abort();
          throw error;
        }
        await completed;
        return next;
      });
  });
}
