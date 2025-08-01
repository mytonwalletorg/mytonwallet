import { swapKeysAndValues } from './iteratees';

describe('swapKeysAndValues', () => {
  it.each([
    {
      name: 'mixed string and number keys/values',
      input: { foo: 123, bar: 456, 789: 'baz' },
      expected: { 123: 'foo', 456: 'bar', baz: '789' },
    },
    {
      name: 'empty object',
      input: {},
      expected: {},
    },
    {
      name: 'duplicate values by keeping the last key',
      input: { a: 'same', b: 'same', c: 'different' },
      expected: { same: 'b', different: 'c' },
    },
  ])('handles $name', ({ input, expected }) => {
    expect(swapKeysAndValues(input as any)).toEqual(expected);
  });
});
