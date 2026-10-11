import {
  fetchWithThrottledProvider,
  getProviderFetchRetryPolicy,
  resetThrottledProviderFetchers,
  ThrottledFetcher,
} from './ThrottledFetcher';

describe('ThrottledFetcher', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetThrottledProviderFetchers();
    global.fetch = jest.fn() as any;
  });

  afterEach(() => {
    jest.useRealTimers();
    resetThrottledProviderFetchers();
    jest.restoreAllMocks();
  });

  it('should honor Retry-After delays for subsequent toncenter requests', async () => {
    const fetchMock = global.fetch as jest.Mock;
    fetchMock
      .mockResolvedValueOnce({
        status: 429,
        ok: false,
        headers: {
          get: (name: string) => (name === 'Retry-After' ? '1' : undefined),
        },
      } as unknown as Response)
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: {
          get: () => undefined,
        },
      } as unknown as Response);

    const url = 'https://api.testnet.ice.io/http/v2/jsonRPC';

    await fetchWithThrottledProvider(url, { method: 'POST' });

    const secondPromise = fetchWithThrottledProvider(url, { method: 'POST' });
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(999);
    await Promise.resolve();
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    await secondPromise;
  });

  it('caps a provider Retry-After pause so one 429 cannot park the origin', async () => {
    const fetchMock = global.fetch as jest.Mock;
    fetchMock
      .mockResolvedValueOnce({
        status: 429,
        ok: false,
        headers: {
          get: (name: string) => (name === 'Retry-After' ? '3600' : undefined),
        },
      } as unknown as Response)
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: {
          get: () => undefined,
        },
      } as unknown as Response);

    const url = 'https://api.mainnet.ice.io/indexer/v3/rates';
    // A timeout above the cap: this test is about the pause itself, not about the caller deadline.
    await fetchWithThrottledProvider(url, undefined, 60000);

    const second = fetchWithThrottledProvider(url, undefined, 60000);

    await jest.advanceTimersByTimeAsync(29999);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    await second;
  });

  it('counts the queue wait against the caller timeout', async () => {
    const fetchMock = global.fetch as jest.Mock;
    fetchMock.mockResolvedValue({ ok: true } as Response);
    const fetcher = new ThrottledFetcher(30000, 1000);

    await fetcher.fetch('https://example.com');

    // Queued behind a 30-second spacing, with a 1-second deadline of its own.
    const queued = fetcher.fetch('https://example.com');
    const expectation = expect(queued).rejects.toMatchObject({ name: 'TimeoutError' });

    await jest.advanceTimersByTimeAsync(1000);

    await expectation;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('should apply the provider retry policy to Toncenter origins', () => {
    expect(getProviderFetchRetryPolicy('https://api.mainnet.ice.io/indexer/v3/rates')).toEqual({
      retries: 6,
      fallbackRetryAfterMs: 5000,
    });
  });

  it('removes a cancelled request from the queue without poisoning later requests', async () => {
    const fetchMock = global.fetch as jest.Mock;
    fetchMock.mockResolvedValue({ ok: true } as Response);
    const fetcher = new ThrottledFetcher(1000);

    await fetcher.fetch('https://example.com');

    const controller = new AbortController();
    const reason = new Error('cancel queued request');
    const cancelled = fetcher.fetch('https://example.com', { signal: controller.signal });
    await Promise.resolve();
    controller.abort(reason);
    await expect(cancelled).rejects.toBe(reason);

    const next = fetcher.fetch('https://example.com');
    await jest.advanceTimersByTimeAsync(1000);
    await next;

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects a cancelled request while it is queued behind another request', async () => {
    const fetchMock = global.fetch as jest.Mock;
    fetchMock.mockResolvedValue({ ok: true } as Response);
    const fetcher = new ThrottledFetcher(1000);

    await fetcher.fetch('https://example.com');

    const preceding = fetcher.fetch('https://example.com');
    const controller = new AbortController();
    const reason = new Error('cancel request behind pending');
    const cancelled = fetcher.fetch('https://example.com', { signal: controller.signal });
    await Promise.resolve();

    controller.abort(reason);
    await expect(cancelled).rejects.toBe(reason);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1000);
    await preceding;
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('distinguishes caller abort reasons from request timeouts', async () => {
    const fetchMock = global.fetch as jest.Mock;
    fetchMock.mockImplementation((_input, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
    }));
    const fetcher = new ThrottledFetcher(0, 1000);
    const controller = new AbortController();
    const callerReason = new Error('caller stopped');
    const callerRequest = fetcher.fetch('https://example.com', { signal: controller.signal });
    const callerExpectation = expect(callerRequest).rejects.toBe(callerReason);
    controller.abort(callerReason);
    await callerExpectation;

    const timedOut = fetcher.fetch('https://example.com');
    const timeoutExpectation = expect(timedOut).rejects.toMatchObject({ name: 'TimeoutError' });
    await jest.advanceTimersByTimeAsync(1000);
    await timeoutExpectation;
  });
});
