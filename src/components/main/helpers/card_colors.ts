const TOKEN_CARD_COLORS = [
  'red',
  'orange',
  'green',
  'sea',
  'purple',
  'pink',
];

const INDIVIDUAL_COLORS: Record<string, string> = {
  'ton-tgr': 'tegro',
};

export function getTokenCardColor(slug: string) {
  if (slug in INDIVIDUAL_COLORS) {
    return INDIVIDUAL_COLORS[slug];
  }

  // https://www.30secondsofcode.org/js/s/sdbm
  const tokenNumber = slug.split('').reduce(
    // eslint-disable-next-line no-return-assign,no-bitwise
    (acc, char) => (acc = char.charCodeAt(0) + (acc << 6) + (acc << 16) - acc),
    0,
  );

  return TOKEN_CARD_COLORS[Math.abs(tokenNumber) % TOKEN_CARD_COLORS.length];
}
