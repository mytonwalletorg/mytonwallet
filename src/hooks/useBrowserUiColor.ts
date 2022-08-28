import { useEffect } from '../lib/teact/teact';

export default function useBrowserUiColor(isActive: boolean, lightColor: string, darkColor: string) {
  useEffect(() => {
    const metaElementLight = getThemeColorMetaElement(true);
    const metaElementDark = getThemeColorMetaElement();

    if (isActive) {
      metaElementLight.setAttribute('content', lightColor);
      metaElementDark.setAttribute('content', darkColor);
    }

    return () => {
      metaElementLight.remove();
      metaElementDark.remove();
    };
  }, [lightColor, isActive, darkColor]);
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
