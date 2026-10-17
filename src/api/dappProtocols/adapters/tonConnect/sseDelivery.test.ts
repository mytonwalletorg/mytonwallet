import type { ApiSseDeliveryState } from '../../../types';

import { SseDeliveryTracker } from './sseDelivery';

const MINUTE = 60 * 1000;

function createStore(initial: { state?: ApiSseDeliveryState; legacyEventId?: string } = {}) {
  const store = { ...initial };
  const writes: string[] = [];

  return {
    store,
    writes,
    storage: {
      loadState: jest.fn(() => Promise.resolve(store.state)),
      loadLegacyEventId: jest.fn(() => Promise.resolve(store.legacyEventId)),
      saveState: jest.fn((state: ApiSseDeliveryState) => {
        writes.push('state');
        store.state = state;
        return Promise.resolve();
      }),
      saveLegacyEventId: jest.fn((eventId: string) => {
        writes.push('legacyEventId');
        store.legacyEventId = eventId;
        return Promise.resolve();
      }),
    },
  };
}

async function createTracker(initial?: Parameters<typeof createStore>[0], clock = { now: 1_000_000 }) {
  const store = createStore(initial);
  const tracker = new SseDeliveryTracker(store.storage, () => clock.now);
  await tracker.load();
  return { tracker, clock, ...store };
}

describe('SseDeliveryTracker', () => {
  it('resumes from the legacy last event id when no delivery state is stored', async () => {
    const { tracker } = await createTracker({ legacyEventId: '10' });

    expect(tracker.getCursor()).toBe('10');
  });

  it('falls back to the legacy id when an older build moved it past the stored state', async () => {
    const { tracker } = await createTracker({
      state: { cursor: '5', lastReceivedId: '7', settled: [['6', 1_000_000]] },
      legacyEventId: '9',
    });

    expect(tracker.getCursor()).toBe('9');
    // The settled set from the stale state is dropped, so nothing it holds can suppress a new delivery
    expect(tracker.receive('6')).toBe(true);
  });

  it('keeps the cursor before a request that is still open and stores the last received id', async () => {
    const { tracker, store } = await createTracker({ legacyEventId: '10' });

    expect(tracker.receive('11')).toBe(true);
    await tracker.settle('unrelated');

    expect(store.state).toMatchObject({ cursor: '10', lastReceivedId: '11' });
    // An older build resuming from the legacy key gets the open request too
    expect(store.legacyEventId).toBe('10');
  });

  it('advances only over a contiguous run of settled events', async () => {
    const { tracker, store } = await createTracker({ legacyEventId: '10' });

    tracker.receive('11');
    tracker.receive('12');
    await tracker.settle('12');
    expect(store.state?.cursor).toBe('10');

    await tracker.settle('11');
    expect(store.state?.cursor).toBe('12');
  });

  it('skips an event that is being handled or was already settled', async () => {
    const { tracker } = await createTracker({ legacyEventId: '10' });

    expect(tracker.receive('11')).toBe(true);
    expect(tracker.receive('11')).toBe(false);

    await tracker.settle('11');
    expect(tracker.receive('11')).toBe(false);
  });

  it('after a restart, delivers the open request again but not the answered one behind it', async () => {
    const first = await createTracker({ legacyEventId: '10' });
    first.tracker.receive('11');
    first.tracker.receive('12');
    await first.tracker.settle('12');

    const second = new SseDeliveryTracker(first.storage, () => first.clock.now);
    await second.load();

    expect(second.getCursor()).toBe('10');
    expect(second.receive('11')).toBe(true);
    expect(second.receive('12')).toBe(false);

    await second.settle('11');
    expect(second.getCursor()).toBe('12');
  });

  it('moves past an open event once the bridge would no longer deliver it', async () => {
    const { tracker, clock } = await createTracker({ legacyEventId: '10' });

    tracker.receive('11');
    clock.now += 6 * MINUTE;
    tracker.receive('12');
    await tracker.settle('12');

    expect(tracker.getCursor()).toBe('12');
  });

  it('never moves the cursor back to a lower numeric id', async () => {
    const { tracker } = await createTracker({ legacyEventId: '20' });

    tracker.receive('15');
    await tracker.settle('15');

    expect(tracker.getCursor()).toBe('20');
  });

  it('forgets settled ids once the bridge can no longer redeliver them', async () => {
    const clock = { now: 1_000_000 };
    const { tracker } = await createTracker({
      state: { cursor: '10', lastReceivedId: '12', settled: [['12', clock.now - 31 * MINUTE]] },
      legacyEventId: '12',
    }, clock);

    expect(tracker.receive('12')).toBe(true);
  });

  it('writes the state before the legacy key', async () => {
    const { tracker, writes, store } = await createTracker({ legacyEventId: '10' });

    tracker.receive('11');
    await tracker.settle('11');

    expect(writes.slice(0, 2)).toEqual(['state', 'legacyEventId']);
    expect(store.legacyEventId).toBe('11');
  });

  it('keeps an open request when the app stops between the two writes', async () => {
    const first = await createTracker({ legacyEventId: '10' });
    // Only the first write lands, whichever key it is; the app stops before the second one
    let writesLeft = 1;
    const stopAfterFirstWrite = (write: () => void) => {
      if (writesLeft-- <= 0) return new Promise<void>(() => undefined);
      write();
      return Promise.resolve();
    };
    first.storage.saveState.mockImplementation((state: ApiSseDeliveryState) => stopAfterFirstWrite(() => {
      first.store.state = state;
    }));
    first.storage.saveLegacyEventId.mockImplementation((eventId: string) => stopAfterFirstWrite(() => {
      first.store.legacyEventId = eventId;
    }));

    first.tracker.receive('11');
    await new Promise((resolve) => setTimeout(resolve, 0));

    const second = new SseDeliveryTracker(first.storage, () => first.clock.now);
    await second.load();

    expect(second.getCursor()).toBe('10');
    expect(second.receive('11')).toBe(true);
  });

  it('stores the newest state even when an earlier write is slow', async () => {
    const { tracker, store, storage } = await createTracker({ legacyEventId: '10' });
    let releaseFirstWrite: (() => void) | undefined;
    storage.saveState.mockImplementationOnce((state: ApiSseDeliveryState) => new Promise<void>((resolve) => {
      releaseFirstWrite = () => {
        store.state = state;
        resolve();
      };
    }));

    tracker.receive('11');
    tracker.receive('12');
    const firstSettle = tracker.settle('11');
    await new Promise((resolve) => setTimeout(resolve, 0));
    // The first write is now stuck in `saveState` with the cursor at 11, and a second one queues behind it
    const secondSettle = tracker.settle('12');
    releaseFirstWrite!();
    await Promise.all([firstSettle, secondSettle]);

    expect(store.state?.cursor).toBe('12');
  });

  it('rejects the settlement when its write fails', async () => {
    const { tracker, storage } = await createTracker({ legacyEventId: '10' });
    storage.saveState.mockRejectedValue(new Error('storage is unavailable'));

    tracker.receive('11');

    await expect(tracker.settle('11')).rejects.toThrow('storage is unavailable');
  });

  it('keeps writing after a failed write', async () => {
    const { tracker, store, storage } = await createTracker({ legacyEventId: '10' });
    storage.saveState.mockRejectedValueOnce(new Error('storage is unavailable'));

    tracker.receive('11');
    await expect(tracker.settle('11')).rejects.toThrow();
    tracker.receive('12');
    await tracker.settle('12');

    expect(store.state?.cursor).toBe('12');
    expect(store.state?.settled.map(([id]) => id).sort()).toEqual(['11', '12']);
  });
});
