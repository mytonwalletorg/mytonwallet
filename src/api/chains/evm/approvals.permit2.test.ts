import { id, zeroPadValue } from 'ethers';

import { isLivePermit2Allowance, readPermit2AllowancePair } from './approvals';

const PERMIT_TOPIC = id('Permit(address,address,address,uint160,uint48,uint48)');
const NVDA = '0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC';
const ROUTER = '0x204FAca1764B154221e35c0d20aBb3c525710498';
const UINT160_MAX = (1n << 160n) - 1n;

describe('readPermit2AllowancePair', () => {
  it('reads the token and router spender from a Permit2 EIP-712 Permit log', () => {
    expect(readPermit2AllowancePair([
      PERMIT_TOPIC,
      zeroPadValue('0x6Add56d0631EBcA7ae53F3C19f61Db9aB9D42CF3', 32),
      zeroPadValue(NVDA, 32),
      zeroPadValue(ROUTER, 32),
    ])).toEqual({
      tokenAddress: NVDA,
      spenderAddress: ROUTER,
    });
  });

  it('ignores logs that are not Permit2 allowance events', () => {
    expect(readPermit2AllowancePair([
      id('Approval(address,address,uint256)'),
      zeroPadValue(NVDA, 32),
      zeroPadValue(ROUTER, 32),
    ])).toBeUndefined();
  });
});

describe('isLivePermit2Allowance', () => {
  const now = 1_791_979_490n;

  it('accepts an unexpired allowance, including the uint160 maximum', () => {
    expect(isLivePermit2Allowance(UINT160_MAX, 1_794_571_052n, now)).toBe(true);
  });

  it('rejects an empty expiration and a zero amount', () => {
    expect(isLivePermit2Allowance(UINT160_MAX, 0n, now)).toBe(false);
    expect(isLivePermit2Allowance(0n, 1_794_571_052n, now)).toBe(false);
  });
});
