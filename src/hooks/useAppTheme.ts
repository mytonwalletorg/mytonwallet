import { useEffect, useState } from '../lib/teact/teact';

import type { AppTheme, Theme } from '../global/types';

import useLastCallback from './useLastCallback';

const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');

function useAppTheme(currentTheme: Theme) {
  const [theme, setTheme] = useState<AppTheme>(
    currentTheme === 'system'
      ? (prefersDark.matches ? 'dark' : 'light')
      : currentTheme,
  );

  const handlePrefersColorSchemeChange = useLastCallback(() => {
    setTheme(() => {
      if (currentTheme === 'system') {
        return prefersDark.matches ? 'dark' : 'light';
      }

      return currentTheme;
    });
  });

  useEffect(() => {
    if (currentTheme !== 'system') return undefined;

    prefersDark.addEventListener('change', handlePrefersColorSchemeChange);

    return () => {
      prefersDark.removeEventListener('change', handlePrefersColorSchemeChange);
    };
  }, [currentTheme]);

  handlePrefersColorSchemeChange();

  return theme;
}

export default useAppTheme;
