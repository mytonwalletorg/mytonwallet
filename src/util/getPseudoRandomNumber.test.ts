import getPseudoRandomNumber from './getPseudoRandomNumber';

describe('getPseudoRandomNumber', () => {
  test('Should return min when min equals max', () => {
    expect(getPseudoRandomNumber(5, 5, 'any')).toBe(5);
  });

  test('Should handle zero-based range', () => {
    const result = getPseudoRandomNumber(0, 10, 'test');
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(10);
  });

  test('Produces same output for identical inputs', () => {
    const first = getPseudoRandomNumber(1, 100, 'seed');
    const second = getPseudoRandomNumber(1, 100, 'seed');
    expect(first).toBe(second);
  });

  describe('Boundary checks', () => {
    const testCases = [
      { min: 1, max: 100 },
      { min: -50, max: 50 },
      { min: 999, max: 1000 },
    ];

    test.each(testCases)('should stay within $min-$max range', ({ min, max }) => {
      const result = getPseudoRandomNumber(min, max, 'input');
      expect(result).toBeGreaterThanOrEqual(min);
      expect(result).toBeLessThanOrEqual(max);
    });
  });

  describe('Different input handling', () => {
    test('empty string produces valid result', () => {
      expect(() => getPseudoRandomNumber(1, 10, '')).not.toThrow();
    });

    test('special characters affect output', () => {
      const str1 = getPseudoRandomNumber(1, 1000, 'hello@');
      const str2 = getPseudoRandomNumber(1, 1000, 'hello#');
      expect(str1).not.toBe(str2);
    });
  });

  describe('Known value verification', () => {
    const testValues = [
      { input: 'apple', min: 0, max: 100, expected: 85 },
      { input: 'banana', min: 10, max: 20, expected: 14 },
      { input: '', min: 1, max: 5, expected: 1 },
    ];

    test.each(testValues)('$input should produce $expected in $min-$max', ({ input, min, max, expected }) => {
      expect(getPseudoRandomNumber(min, max, input)).toBe(expected);
    });
  });
});
