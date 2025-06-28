import { crc32 } from './crcHash';

describe('crc32', () => {
  test.each([
    ['an empty input', '', 0],
    ['a short input', 'Hello, world', 3885672898],
    ['a long input', 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.', 2561852861], // eslint-disable-line @stylistic/max-len
    ['a unicode input', '这是一只猫：🐱', 3043104540],
  ])('with %s', (_, input, expectedHash) => {
    expect(crc32(input)).toBe(expectedHash);
  });
});
