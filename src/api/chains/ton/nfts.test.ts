import { calculateNftTransferFee } from './nfts';

describe('calculateNftTransferFee', () => {
  it('calculates for 1 NFT', () => {
    expect(calculateNftTransferFee(1, 1, 2939195n, 10000000n)).toBe(12939195n);
  });

  it('calculates for batch', () => {
    expect(calculateNftTransferFee(3, 3, 6001837n, 100000000n)).toBe(306001837n);
  });

  it('calculates for multiple complete and 1 incomplete batch', () => {
    expect(calculateNftTransferFee(9, 4, 7533158n, 1000000000n)).toBe(9018832895n);
  });

  it('calculates for multiple complete batchs', () => {
    expect(calculateNftTransferFee(12, 4, 7533158n, 10000000000n)).toBe(120022599474n);
  });
});
