import type { UserToken } from '../../../global/types';
import type { LangFn } from '../../../hooks/useLang';

import { CHAIN_ORDER } from '../../../util/chain';
import { buildSegmentsByChain } from './buildStackSegments';

const lang = ((key: string) => key) as LangFn;

describe('buildSegmentsByChain', () => {
  it('keeps the top 9 chains and collapses the rest into "Other"', () => {
    const chains = CHAIN_ORDER.slice(0, 12);
    const tokens = chains.map((chain, index) => buildToken(chain, index + 1));

    const segments = buildSegmentsByChain(lang, tokens, 'USD');

    expect(segments).toHaveLength(10);
    expect(segments[0]).toMatchObject({ id: 'other', rawAmount: 1 + 2 + 3 });
    expect(segments.slice(1).map((s) => s.id)).toEqual(chains.slice(3));
  });

  it('shows every chain when there are at most 10', () => {
    const tokens = CHAIN_ORDER.slice(0, 10).map((chain, index) => buildToken(chain, index + 1));

    const segments = buildSegmentsByChain(lang, tokens, 'USD');

    expect(segments).toHaveLength(10);
    expect(segments.some((s) => s.id === 'other')).toBe(false);
  });
});

function buildToken(chain: UserToken['chain'], totalValue: number) {
  return { chain, totalValue: String(totalValue) } as UserToken;
}
