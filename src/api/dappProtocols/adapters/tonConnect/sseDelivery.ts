import type { ApiSseDeliveryState } from '../../../types';

import { logDebugError } from '../../../../util/logs';

// The bridge drops a message once its `ttl` (at most 300 s) runs out, so an event older than that is never delivered again
const HEAD_SHIFT_MS = 5 * 60 * 1000;
// Settled ids only need to outlive the bridge redelivering them
const SETTLED_RETENTION_MS = 30 * 60 * 1000;
const SETTLED_CAP = 200;

export interface SseDeliveryStorage {
  loadState: () => Promise<ApiSseDeliveryState | undefined>;
  loadLegacyEventId: () => Promise<string | undefined>;
  saveState: (state: ApiSseDeliveryState) => Promise<unknown>;
  saveLegacyEventId: (eventId: string) => Promise<unknown>;
}

/**
 * Decides where the TON Connect SSE stream resumes. The cursor advances only over events the wallet has settled
 * (answered, rejected or ignored), so a request that is still open when the app stops is delivered again by the next
 * connection, while the ids settled past the cursor keep an answered request from being shown twice.
 *
 * The state is one storage write, so it is never half updated. The legacy `sseLastEventId` follows it with the cursor,
 * for an older build to resume from: that build gets every request still open, though it may also show again one that
 * was settled ahead of the cursor within the bridge's message lifetime.
 */
export class SseDeliveryTracker {
  private loadPromise?: Promise<void>;

  private cursor?: string;

  private lastReceivedId?: string;

  private readonly inFlight = new Set<string>();

  private readonly settled = new Map<string, number>();

  private receivedOrder: { id: string; receivedAt: number }[] = [];

  private persistChain: Promise<void> = Promise.resolve();

  private lastWrite: Promise<void> = Promise.resolve();

  private pendingWrite?: Promise<void>;

  constructor(private readonly storage: SseDeliveryStorage, private readonly now = () => Date.now()) {
  }

  load() {
    this.loadPromise ??= this.restore();
    return this.loadPromise;
  }

  getCursor() {
    return this.cursor;
  }

  /**
   * Must run synchronously as the first thing for every incoming event. Returns `false` for an event that is being
   * handled or was already settled, which the caller must skip.
   */
  receive(id: string) {
    if (this.inFlight.has(id)) {
      return false;
    }

    if (this.settled.has(id)) {
      // Still counts for ordering, so the cursor can move past a redelivered event without handling it again
      const previousCursor = this.cursor;
      this.addToOrder(id);
      this.advance();
      if (this.cursor !== previousCursor) {
        void this.persist();
      }
      return false;
    }

    this.inFlight.add(id);
    this.addToOrder(id);
    this.lastReceivedId = id;
    void this.persist();
    return true;
  }

  /**
   * Resolves once the settlement is in storage and rejects when the write carrying it fails. Settling an id again
   * reports the latest write, so it rejects until a write has landed since the failure. Failures are logged here.
   */
  settle(id: string): Promise<void> {
    if (!this.inFlight.delete(id) && this.settled.has(id)) {
      return this.lastWrite;
    }

    this.settled.set(id, this.now());
    this.advance();
    this.prune();
    return this.persist();
  }

  private async restore() {
    const [state, legacyEventId] = await Promise.all([
      this.storage.loadState().catch(() => undefined),
      this.storage.loadLegacyEventId().catch(() => undefined),
    ]);

    // Without a state, or when an older build received events after it was written, `sseLastEventId` holds the last
    // event that build received. Resuming after it is what that build would do, so no settled request is replayed.
    if (!state || isAhead(legacyEventId, state.lastReceivedId)) {
      this.cursor = legacyEventId;
      this.lastReceivedId = legacyEventId;
      return;
    }

    this.cursor = state.cursor;
    this.lastReceivedId = state.lastReceivedId;
    for (const [id, settledAt] of state.settled ?? []) {
      this.settled.set(id, settledAt);
    }
    this.prune();
  }

  private addToOrder(id: string) {
    if (!this.receivedOrder.some((entry) => entry.id === id)) {
      this.receivedOrder.push({ id, receivedAt: this.now() });
    }
  }

  private advance() {
    const now = this.now();

    while (this.receivedOrder.length) {
      const [head] = this.receivedOrder;
      if (!this.settled.has(head.id) && now - head.receivedAt < HEAD_SHIFT_MS) {
        break;
      }

      this.receivedOrder.shift();
      if (!isBehind(head.id, this.cursor)) {
        this.cursor = head.id;
      }
    }
  }

  private prune() {
    const now = this.now();
    const entries = [...this.settled.entries()]
      .filter(([, settledAt]) => now - settledAt < SETTLED_RETENTION_MS)
      .sort(([, a], [, b]) => b - a)
      .slice(0, SETTLED_CAP);

    this.settled.clear();
    for (const [id, settledAt] of entries) {
      this.settled.set(id, settledAt);
    }
  }

  /**
   * Writes run one at a time and each one stores the state as it is when the write starts, so a slow write can never
   * land after a newer one. Changes made while a write waits to start are carried by that same write.
   */
  private persist(): Promise<void> {
    if (this.pendingWrite) {
      return this.pendingWrite;
    }

    const write = this.persistChain
      .then(async () => {
        this.pendingWrite = undefined;

        const { cursor } = this;
        const state: ApiSseDeliveryState = {
          cursor,
          lastReceivedId: this.lastReceivedId,
          settled: [...this.settled.entries()],
        };

        // The state goes first: if the legacy write is lost, `sseLastEventId` stays behind the state and is ignored
        await this.storage.saveState(state);
        if (cursor) {
          await this.storage.saveLegacyEventId(cursor);
        }
      });

    this.pendingWrite = write;
    this.lastWrite = write;
    // A failed write is logged once and does not hold up the next one, which stores the full current state
    this.persistChain = write.catch((err) => {
      logDebugError('tonConnect:sseDelivery', err);
    });

    return write;
  }
}

/** Bridge event ids are increasing integers; any other form never counts as behind */
function isBehind(id: string, cursor?: string) {
  if (cursor === undefined || !/^\d+$/.test(id) || !/^\d+$/.test(cursor)) {
    return false;
  }

  return BigInt(id) < BigInt(cursor);
}

/** Whether `id` is a later bridge event than `than`; an id the state has never seen counts as later */
function isAhead(id?: string, than?: string) {
  if (id === undefined) {
    return false;
  }
  if (than === undefined) {
    return true;
  }

  return isBehind(than, id);
}
