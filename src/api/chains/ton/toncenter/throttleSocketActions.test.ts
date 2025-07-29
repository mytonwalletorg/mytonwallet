import type { ActivitiesUpdate } from './socket';

import { pause } from '../../../../util/schedulers';
import { makeMockTransactionActivity } from '../../../../../tests/mocks';
import { throttleToncenterSocketActions } from './throttleSocketActions';

describe('throttleToncenterSocketActions', () => {
  const DELAY_MS = 20;

  it.concurrent('handles "pending -> long delay -> pending -> confirmed" sequence correctly', async () => {
    const onUpdates = jest.fn();
    const throttled = throttleToncenterSocketActions(DELAY_MS, onUpdates);

    const firstPending = createMockUpdate('hash1', true);
    const secondPending = createMockUpdate('hash1', true);
    const confirmed = createMockUpdate('hash1', false);

    // Step 1: First pending update arrives (should be immediate)
    throttled(firstPending);
    expect(onUpdates).toHaveBeenCalledWith([firstPending]);

    // Step 2: Wait longer than delayMs (simulating "long time")
    await pause(DELAY_MS + 10);
    expect(onUpdates).toHaveBeenCalledTimes(1);

    // Step 3: Second pending update arrives (should be delayed because it's not the first)
    throttled(secondPending);
    expect(onUpdates).toHaveBeenCalledTimes(1);

    // Step 4: Confirmed update arrives immediately after (should be immediate and cancel any throttling)
    throttled(confirmed);
    expect(onUpdates).toHaveBeenCalledTimes(2);
    expect(onUpdates).toHaveBeenNthCalledWith(2, [confirmed]);

    // Step 5: Verify no additional calls after full delay
    await pause(DELAY_MS + 10);
    expect(onUpdates).toHaveBeenCalledTimes(2);
  });

  it.concurrent('throttles subsequent pending updates with same hash', async () => {
    const onUpdates = jest.fn();
    const throttled = throttleToncenterSocketActions(DELAY_MS, onUpdates);

    const firstPending = createMockUpdate('hash1', true);
    const secondPending = createMockUpdate('hash1', true);
    const thirdPending = createMockUpdate('hash1', true);

    // First update should be immediate
    throttled(firstPending);
    expect(onUpdates).toHaveBeenCalledWith([firstPending]);

    // Subsequent updates should be throttled
    throttled(secondPending);
    throttled(thirdPending);
    expect(onUpdates).toHaveBeenCalledTimes(1);

    // After delay, only the latest update should be delivered
    await pause(DELAY_MS + 10); // Add small buffer for timing
    expect(onUpdates).toHaveBeenCalledTimes(2);
    expect(onUpdates).toHaveBeenNthCalledWith(2, [thirdPending]);
  });

  it.concurrent('handles multiple hashes independently', async () => {
    const onUpdates = jest.fn();
    const throttled = throttleToncenterSocketActions(DELAY_MS, onUpdates);

    const pending1 = createMockUpdate('hash1', true);
    const pending2 = createMockUpdate('hash2', true);
    const pending1Again = createMockUpdate('hash1', true);

    // First updates for each hash should be immediate
    throttled(pending1);
    throttled(pending2);
    expect(onUpdates).toHaveBeenCalledTimes(2);

    // Subsequent update for hash1 should be throttled
    throttled(pending1Again);
    expect(onUpdates).toHaveBeenCalledTimes(2);

    // After delay, the throttled update should be delivered
    await pause(DELAY_MS + 10); // Add small buffer for timing
    expect(onUpdates).toHaveBeenCalledTimes(3);
    expect(onUpdates).toHaveBeenNthCalledWith(3, [pending1Again]);
  });
});

function createMockUpdate(messageHashNormalized: string, arePending: boolean): ActivitiesUpdate {
  return {
    address: 'test-address',
    messageHashNormalized,
    arePending,
    activities: [makeMockTransactionActivity({ id: 'test-activity' })],
  };
}
