import type { Theme } from '../global/types';

import { IS_CAPACITOR } from '../config';
import { requestMeasure } from '../lib/fasterdom/fasterdom';
import { switchStatusBar } from './capacitor/switchStatusBar';

const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
let currentTheme: Theme;
let forcedDarkStatusBarBackground: boolean | undefined;

export default function switchTheme(theme: Theme, isInModal?: boolean) {
  currentTheme = theme;

  setThemeValue();
  setStatusBarStyle({
    isInModal,
  });
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

export function setStatusBarStyle(options?: { forceDarkBackground?: boolean; isInModal?: boolean }) {
  if (!IS_CAPACITOR) return;

  if (options?.forceDarkBackground !== undefined) forcedDarkStatusBarBackground = options.forceDarkBackground;
  switchStatusBar(currentTheme, prefersDark.matches, forcedDarkStatusBarBackground, options?.isInModal);
}

prefersDark.addEventListener('change', handlePrefersColorSchemeChange);
