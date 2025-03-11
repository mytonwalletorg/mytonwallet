import { getGlobal } from '../global';

import type { Theme } from '../global/types';

import { IS_CAPACITOR, IS_TELEGRAM_APP } from '../config';
import { requestMeasure } from '../lib/fasterdom/fasterdom';
import { switchStatusBar } from './capacitor/switchStatusBar';
import cssColorToHex from './cssColorToHex';
import { getTelegramApp, getTelegramAppAsync } from './telegram';

const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
let currentTheme: Theme;
let forcedDarkStatusBarBackground: boolean | undefined;

export default function switchTheme(theme: Theme, isInModal?: boolean) {
  currentTheme = theme;

  setThemeValue();
  setStatusBarStyle({ isInModal });
  setThemeColor();
}

function setThemeValue() {
  const isDarkTheme = currentTheme === 'dark'
    || (currentTheme === 'system'
      && (IS_TELEGRAM_APP
        ? getTelegramApp()?.colorScheme === 'dark'
        : prefersDark.matches)
    );

  document.documentElement.classList.toggle('theme-dark', isDarkTheme);
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
  if (IS_TELEGRAM_APP) {
    requestMeasure(() => {
      const color = getComputedStyle(document.documentElement)
        .getPropertyValue('--color-background-second');
      if (!color) return;

      const hexColor = cssColorToHex(color) as `#${string}`;

      getTelegramApp()?.setHeaderColor(hexColor);
      getTelegramApp()?.setBackgroundColor(hexColor);
      getTelegramApp()?.setBottomBarColor(hexColor);
    });

    return;
  }
  if (!IS_CAPACITOR) return;

  if (options?.forceDarkBackground !== undefined) forcedDarkStatusBarBackground = options.forceDarkBackground;
  switchStatusBar(currentTheme, prefersDark.matches, forcedDarkStatusBarBackground, options?.isInModal);
}

prefersDark.addEventListener('change', handlePrefersColorSchemeChange);

if (IS_TELEGRAM_APP) {
  void getTelegramAppAsync().then((telegramApp) => {
    telegramApp!.onEvent('themeChanged', onThemeChanged);
  });
}

export function unsubscribeOnTelegramThemeChange() {
  getTelegramApp()?.offEvent('themeChanged', onThemeChanged);
}

function onThemeChanged() {
  if (getGlobal().settings.theme === 'system') {
    handlePrefersColorSchemeChange();
  }
}
