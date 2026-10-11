import { ION_BNB_MAINNET } from '../config';
import { TON_USDT_MAINNET } from '../../tests/mocks/tokens';
import { getIsSupportedChain, getIsTokenKept } from './chain';

describe('getIsSupportedChain', () => {
  it('recognizes configured chains in the legacy browser baseline', () => {
    const descriptor = Object.getOwnPropertyDescriptor(Object, 'hasOwn')!;
    Object.defineProperty(Object, 'hasOwn', { ...descriptor, value: undefined });

    try {
      expect(getIsSupportedChain('ton')).toBe(true);
      expect(getIsSupportedChain('bnb')).toBe(true);
      expect(getIsSupportedChain('bitcoin')).toBe(false);
      expect(getIsSupportedChain('constructor')).toBe(false);
    } finally {
      Object.defineProperty(Object, 'hasOwn', descriptor);
    }
  });
});

describe('getIsTokenKept', () => {
  it('keeps the listed token of a chain that names its own', () => {
    expect(getIsTokenKept('bnb', ION_BNB_MAINNET.slug)).toBe(true);
  });

  it('drops an unlisted token of that chain', () => {
    expect(getIsTokenKept('bnb', 'bnb-0xdeadbeef')).toBe(false);
  });

  it('keeps any token of a chain that names none', () => {
    expect(getIsTokenKept('ton', TON_USDT_MAINNET.slug)).toBe(true);
    expect(getIsTokenKept('ton', 'ton-eqsomethingelse')).toBe(true);
  });
});
