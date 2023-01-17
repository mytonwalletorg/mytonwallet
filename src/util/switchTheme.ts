import type { Theme } from '../global/types';

const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
let currentTheme: Theme;

export default function switchTheme(theme: Theme) {
  currentTheme = theme;
  setThemeValue();
}

function setThemeValue() {
  document.documentElement.classList.toggle(
    'theme-dark',
    currentTheme === 'dark' || (currentTheme === 'system' && prefersDark.matches),
  );
}

prefersDark.addEventListener('change', setThemeValue);
