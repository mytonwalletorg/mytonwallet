export default function cssColorToHex(cssColor: string) {
  if (/^#[0-9A-F]{6}$/i.test(cssColor)) return cssColor;

  return `#${cssColor.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+\.{0,1}\d*))?\)$/)!
    .slice(1)
    .map((n: string, i: number) => (i === 3 ? Math.round(parseFloat(n) * 255) : parseFloat(n))
      .toString(16)
      .padStart(2, '0')
      .replace('NaN', ''))
    .join('')}`;
}
