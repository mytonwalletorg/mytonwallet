import symbolFixture from '../../../tests/fixtures/agentV2/wallet-asset-symbol-matching.v1.json';
import { matchesSelector } from './walletQueryAssets';

const tonUsdt = { chain: 'ton' as const, slug: 'ton-eqcxe6mutq', symbol: 'USD₮', tokenAddress: 'EQCxE6mUtQ' };

describe('matchesSelector', () => {
  // The agent proves each row of a ticker filter with the same rule, so the two must agree case by case
  it.each(symbolFixture.cases)('matches a ticker as the agent does: $id', (
    { selectorSymbol, assetSymbol, matches },
  ) => {
    expect(matchesSelector({ ...tonUsdt, symbol: assetSymbol }, { symbol: selectorSymbol })).toBe(matches);
  });

  it('keeps the other selector fields apart', () => {
    expect(matchesSelector(tonUsdt, { symbol: 'USDT', chain: 'tron' })).toBe(false);
  });
});
