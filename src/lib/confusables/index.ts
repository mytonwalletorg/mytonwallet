// Original repo: https://github.com/gc/confusables

import { checkLNP, clean } from './util';
import { characters } from './characters';

const alphabetMap = new Map<string, string[]>();
const confusablesMap = new Map<string, string>();

for (const [base, alts] of characters.entries()) {
  alphabetMap.set(base, [...alts]);

  for (const char of alts) {
    confusablesMap.set(char, base);
  }
}

export function cleanText(str: string) {
  if (checkLNP(str)) return str;

  let newStr = '';

  for (const char of clean(str)) {
    newStr += confusablesMap.get(char) || char;
  }

  return newStr;
}
