// Eastern-Arabic (ar) and Persian (fa) digit glyphs, indexed by the ASCII digit they replace
const NATIVE_DIGITS: Record<string, string> = {
  fa: '۰۱۲۳۴۵۶۷۸۹',
  ar: '٠١٢٣٤٥٦٧٨٩',
};

const LATIN_DIGIT_BY_NATIVE: Record<string, string> = Object.fromEntries(
  Object.values(NATIVE_DIGITS).flatMap((digits) => [...digits].map((glyph, digit) => [glyph, String(digit)])),
);
const NATIVE_DIGIT_REGEX = new RegExp(`[${Object.keys(LATIN_DIGIT_BY_NATIVE).join('')}]`, 'g');

// Resolved once per language change (see `setLanguage`), not on every format call
let currentDigits: string | undefined;

export function setNativeDigitsLang(langCode?: string) {
  currentDigits = langCode ? NATIVE_DIGITS[langCode] : undefined;
}

// Swaps ASCII digits for the current language's native glyphs
export function toNativeDigits(value: string): string {
  const digits = currentDigits;
  if (!digits) return value;

  return value.replace(/[0-9]/g, (d) => digits[+d]);
}

// Recognizes the glyphs of every supported language, not only the current one, because the keyboard layout
// does not follow the interface language
export function toLatinDigits(value: string): string {
  return value.replace(NATIVE_DIGIT_REGEX, (glyph) => LATIN_DIGIT_BY_NATIVE[glyph]);
}
