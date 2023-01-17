import type { Theme } from '../global/types';

import { useEffect } from '../lib/teact/teact';

interface Props {
  isActive: boolean;
  currentTheme: Theme;
  lightColor: string;
  darkColor: string;
}

export default function useBrowserUiColor({
  isActive,
  currentTheme,
  lightColor,
  darkColor,
}: Props) {
  useEffect(() => {
    const metaElementLight = getThemeColorMetaElement(true);
    const metaElementDark = getThemeColorMetaElement();
    const lightContent = currentTheme === 'dark' ? darkColor : lightColor;
    const darkContent = currentTheme === 'light' ? lightColor : darkColor;

    if (isActive) {
      metaElementLight.setAttribute('content', lightContent);
      metaElementDark.setAttribute('content', darkContent);
    }

    return () => {
      metaElementLight.remove();
      metaElementDark.remove();
    };
  }, [lightColor, isActive, darkColor, currentTheme]);
}

function getThemeColorMetaElement(isLight?: boolean) {
  let metaThemeColor = document.querySelector(
    `meta[name="theme-color"][media="(prefers-color-scheme: ${isLight ? 'light' : 'dark'})"]`,
  );

  if (!metaThemeColor) {
    metaThemeColor = document.createElement('meta');
    metaThemeColor.setAttribute('name', 'theme-color');
    metaThemeColor.setAttribute('media', `(prefers-color-scheme: ${isLight ? 'light' : 'dark'})`);
    document.getElementsByTagName('head')[0].appendChild(metaThemeColor);
  }

  return metaThemeColor;
}
