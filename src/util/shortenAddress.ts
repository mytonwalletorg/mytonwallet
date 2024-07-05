import withCache from './withCache';

const DEFAULT_SHIFT = 6;
const FILLER = '...';
const FILLER_LENGTH = FILLER.length;

export const shortenAddress = withCache((address: string, shift = DEFAULT_SHIFT, fromRight = shift) => {
  if (!address) return undefined;

  if (address.length <= shift + fromRight + FILLER_LENGTH) return address;

  return `${address.slice(0, shift)}${FILLER}${address.slice(-fromRight)}`;
});
