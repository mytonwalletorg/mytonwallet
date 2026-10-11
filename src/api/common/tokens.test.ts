import type { ApiTokenWithPrice } from '../types';

import {
  buildTokenSlug,
  getTokenByAddress,
  getTokensCache,
  pauseTokenUpdates,
  resumeTokenUpdates,
  sendUpdateTokens,
  updateTokens,
} from './tokens';

jest.mock('../db', () => ({
  tokenRepository: {
    bulkPut: jest.fn().mockResolvedValue(undefined),
  },
}));

function makeToken(
  slug: string,
  chain: ApiTokenWithPrice['chain'],
  tokenAddress: string,
  rest?: Partial<ApiTokenWithPrice>,
): ApiTokenWithPrice {
  return {
    slug,
    chain,
    tokenAddress,
    name: slug,
    symbol: slug.toUpperCase(),
    decimals: 18,
    priceUsd: 0,
    percentChange24h: 0,
    ...rest,
  };
}

describe('token lookup', () => {
  it('does not resolve a chainless address when multiple cached tokens share it', () => {
    const cache = getTokensCache();
    const address = '0x00000000000000000000000000000000ABCDEF12';
    const tonSlug = buildTokenSlug('ton', address);
    const bnbSlug = buildTokenSlug('bnb', address);
    const previousTonToken = cache.bySlug[tonSlug];
    const previousBnbToken = cache.bySlug[bnbSlug];

    cache.bySlug[tonSlug] = makeToken(tonSlug, 'ton', address.toLowerCase());
    cache.bySlug[bnbSlug] = makeToken(bnbSlug, 'bnb', address.toUpperCase());

    try {
      expect(getTokenByAddress(address)).toBeUndefined();
      expect(getTokenByAddress(address, 'ton')?.slug).toBe(tonSlug);
      expect(getTokenByAddress(address, 'bnb')?.slug).toBe(bnbSlug);
    } finally {
      if (previousTonToken) {
        cache.bySlug[tonSlug] = previousTonToken;
      } else {
        delete cache.bySlug[tonSlug];
      }

      if (previousBnbToken) {
        cache.bySlug[bnbSlug] = previousBnbToken;
      } else {
        delete cache.bySlug[bnbSlug];
      }
    }
  });
});

describe('token updates', () => {
  beforeEach(pauseTokenUpdates);

  it('only sends repeated updates when explicitly requested', async () => {
    const cache = getTokensCache();
    const slug = 'ton-event-storm-regression';
    const token = makeToken(slug, 'ton', 'EQEventStormRegression');
    const previousToken = cache.bySlug[slug];
    const sendUpdate = jest.fn();

    delete cache.bySlug[slug];

    try {
      await updateTokens([token], sendUpdate);
      expect(sendUpdate).toHaveBeenCalledTimes(1);

      sendUpdate.mockClear();
      await updateTokens([{ ...token, name: 'Updated name' }], sendUpdate);
      expect(sendUpdate).not.toHaveBeenCalled();

      await updateTokens([{ ...token, codeHash: 'hash' }], sendUpdate, true);
      expect(sendUpdate).toHaveBeenCalledTimes(1);
    } finally {
      if (previousToken) {
        cache.bySlug[slug] = previousToken;
      } else {
        delete cache.bySlug[slug];
      }
    }
  });

  it('keeps updates paused while the initial backend update is unavailable', () => {
    const onUpdate = jest.fn();

    sendUpdateTokens(onUpdate);

    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('coalesces updates until the initial backend update succeeds', () => {
    const firstOnUpdate = jest.fn();
    const latestOnUpdate = jest.fn();

    sendUpdateTokens(firstOnUpdate);
    sendUpdateTokens(latestOnUpdate);

    expect(firstOnUpdate).not.toHaveBeenCalled();
    expect(latestOnUpdate).not.toHaveBeenCalled();

    resumeTokenUpdates();

    expect(firstOnUpdate).not.toHaveBeenCalled();
    expect(latestOnUpdate).toHaveBeenCalledTimes(1);
    expect(latestOnUpdate).toHaveBeenCalledWith(expect.objectContaining({
      type: 'updateTokens',
      arePricesFresh: false,
    }));
  });

  it('sends updates immediately after the initial backend update succeeds', () => {
    const onUpdate = jest.fn();
    resumeTokenUpdates();

    sendUpdateTokens(onUpdate);

    expect(onUpdate).toHaveBeenCalledTimes(1);
  });
});

describe('buildTokenSlug', () => {
  const EVM_ADDRESS = '0xE1ab61f7b093435204dF32F5b3A405de55445Ea8';
  const TON_ADDRESS = 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs';

  it('keeps the full address so a look-alike token cannot collide', () => {
    const lookAlike = `${EVM_ADDRESS.slice(0, 10)}00000000000000000000000000000000`;
    expect(buildTokenSlug('bnb', EVM_ADDRESS)).toBe(`bnb-${EVM_ADDRESS}`);
    expect(buildTokenSlug('bnb', lookAlike)).not.toBe(buildTokenSlug('bnb', EVM_ADDRESS));
  });

  it('maps every spelling of an address to one slug', () => {
    expect(buildTokenSlug('bnb', EVM_ADDRESS.toLowerCase())).toBe(`bnb-${EVM_ADDRESS}`);
    expect(buildTokenSlug('ton', '0:b113a994b5024a16719f69139328eb759596c38a25f59028b146fecdc3621dfe'))
      .toBe(`ton-${TON_ADDRESS}`);
    expect(buildTokenSlug('ton', 'UQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_p0p')).toBe(`ton-${TON_ADDRESS}`);
  });

  it('keeps an invalid address whole', () => {
    expect(buildTokenSlug('ton', 'not-an-address')).toBe('ton-not-an-address');
  });
});
