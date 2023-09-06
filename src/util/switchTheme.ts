import { requestMeasure } from '../lib/fasterdom/fasterdom';

import type { Theme } from '../global/types';

const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
let currentTheme: Theme;

export default function switchTheme(theme: Theme) {
  currentTheme = theme;

  setThemeValue();
  setThemeColor();
}

function setThemeValue() {
  document.documentElement.classList.toggle(
    'theme-dark',
    currentTheme === 'dark' || (currentTheme === 'system' && prefersDark.matches),
  );
}

function setThemeColor() {
  requestMeasure(() => {
    const color = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-background-second');

    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', color);
  });
}

prefersDark.addEventListener('change', setThemeValue);
