import withCache from './withCache';

const DEFAULT_SHIFT = 6;

export const shortenAddress = withCache((address: string, shift = DEFAULT_SHIFT, fromRight = shift) => {
  if (!address) return undefined;

  return `${address.slice(0, shift)}...${address.slice(-fromRight)}`;
});
