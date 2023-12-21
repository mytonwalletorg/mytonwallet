import type { Theme } from '../global/types';

import { IS_CAPACITOR } from '../config';
import { requestMeasure } from '../lib/fasterdom/fasterdom';
import { switchStatusBar } from './capacitor';

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

function handlePrefersColorSchemeChange() {
  setThemeValue();
  setStatusBarStyle();
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

export function setStatusBarStyle(forceDarkBackground?: boolean) {
  if (!IS_CAPACITOR) return;

  switchStatusBar(currentTheme, prefersDark.matches, forceDarkBackground);
}

prefersDark.addEventListener('change', handlePrefersColorSchemeChange);
