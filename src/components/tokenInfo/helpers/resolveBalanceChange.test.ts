import { resolveBalanceChange } from './resolveBalanceChange';

describe('resolveBalanceChange', () => {
  it('keeps the 24h change without waiting for the history', () => {
    expect(resolveBalanceChange({ shouldUseChange24h: true, isLoading: true })).toEqual({ type: 'change24h' });
  });

  it('waits for the history of the shown period', () => {
    expect(resolveBalanceChange({ shouldUseChange24h: false, isLoading: true })).toEqual({ type: 'loading' });
  });

  it('shows no change for a series with nothing to compare', () => {
    expect(resolveBalanceChange({ shouldUseChange24h: false, isLoading: false })).toEqual({ type: 'empty' });
    expect(resolveBalanceChange({
      shouldUseChange24h: false, isLoading: false, price: 2, initialPrice: 0,
    })).toEqual({ type: 'empty' });
  });

  it('compares the shown price with the start of the period', () => {
    expect(resolveBalanceChange({
      shouldUseChange24h: false, isLoading: false, price: 2, initialPrice: 1,
    })).toEqual({ type: 'chart', price: 2, initialPrice: 1 });
  });
});
