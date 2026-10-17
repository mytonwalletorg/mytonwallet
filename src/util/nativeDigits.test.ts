import { setNativeDigitsLang, toLatinDigits, toNativeDigits } from './nativeDigits';

describe('toLatinDigits', () => {
  it.each(['ar', 'fa'])('restores ASCII digits from %s glyphs', (langCode) => {
    setNativeDigitsLang(langCode);
    const nativeDigits = toNativeDigits('0123456789');
    setNativeDigitsLang();

    expect(toLatinDigits(nativeDigits)).toBe('0123456789');
  });

  it('keeps ASCII digits and other characters', () => {
    expect(toLatinDigits('1٫۵,٠ TON')).toBe('1٫5,0 TON');
  });
});
