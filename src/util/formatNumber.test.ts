import { WHOLE_PART_DELIMITER } from '../config';
import { formatNumber } from './formatNumber';

const testCasesTruncate = [
  [44.0074, 2, '44'],
  [44.074, 2, '44.07'],
  [1.00032, 2, '1'],
  [0.2857, 2, '0.28'],
  [0.02857, 2, '0.028'],
  [0.002857, 2, '0.0028'],
  [0.00002857, 2, '0.000028'],
] as const;

const testCasesNoTruncate = [
  [0.09739, 2, '0.097'],
  [0.09759, 2, '0.098'],
  [0.0009759, 2, '0.00098'],
  [0.0000069759, 2, '0.000007'],
  [44.0074, 2, '44.01'],
  [12.3456, 2, '12.35'],
  [0.08279, 2, '0.083'],
  [1.00032, 2, '1'],
  [0.095121, 4, '0.09512'],
  [1.09518, 4, '1.0952'],
  [1.00168, 4, '1.0017'],
  [1.0000901, 4, '1.0001'],
  [1000.03957, 2, `1${WHOLE_PART_DELIMITER}000.04`],
  [349230.03957, 2, `349${WHOLE_PART_DELIMITER}230.04`],
  [999.3456, 2, '999.35'],
  [999.99999, 2, `1${WHOLE_PART_DELIMITER}000`],
] as const;

describe('formatNumber', () => {
  describe(
    'Rounding mode: Big.roundDown (Rounds towards zero. I.e. truncate, no rounding.)',
    () => {
      for (const [input, fractionDigits, expected] of testCasesTruncate) {
        test(`${input} => ${expected}`, () => {
          expect(formatNumber(input, fractionDigits)).toBe(expected);
        });
      }
    },
  );

  describe(
    'Rounding mode: Big.roundHalfUp (Rounds towards nearest neighbour.'
    + ' If equidistant, rounds away from zero.)',
    () => {
      for (const [input, fractionDigits, expected] of testCasesNoTruncate) {
        test(`${input} => ${expected}`, () => {
          expect(formatNumber(input, fractionDigits, true)).toBe(expected);
        });
      }
    },
  );
});
