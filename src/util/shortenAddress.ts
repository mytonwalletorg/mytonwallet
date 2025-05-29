import withCache from './withCache';

export const MEANINGFUL_CHAR_LENGTH = 6;
const FILLER = '···';
const FILLER_LENGTH = FILLER.length;

export const shortenAddress = withCache((address: string, shift = MEANINGFUL_CHAR_LENGTH, fromRight = shift) => {
  if (!address) return undefined;

  if (address.length <= shift + fromRight + FILLER_LENGTH) return address;

  return `${address.slice(0, shift)}${FILLER}${address.slice(-fromRight)}`;
});
