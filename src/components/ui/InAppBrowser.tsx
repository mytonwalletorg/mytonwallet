import { BottomSheet } from 'native-bottom-sheet';
import React, { memo, useEffect } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { CustomInAppBrowserObject } from '../explore/hooks/useWebViewBridge';

import { ANIMATION_LEVEL_DEFAULT } from '../../config';
import buildClassName from '../../util/buildClassName';
import { INAPP_BROWSER_OPTIONS } from '../../util/capacitor';
import { compact } from '../../util/iteratees';
import { logDebugError } from '../../util/logs';
import { getHostnameFromUrl } from '../../util/url';
import { IS_DELEGATING_BOTTOM_SHEET, IS_IOS, IS_IOS_APP } from '../../util/windowEnvironment';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useShowTransition from '../../hooks/useShowTransition';
import { useDappBridge } from '../explore/hooks/useDappBridge';

import styles from './InAppBrowser.module.scss';

interface StateProps {
  title?: string;
  subtitle?: string;
  url?: string;
  theme: string;
  animationLevel?: number;
}

let inAppBrowser: Cordova['InAppBrowser'] | undefined;
let hideCompletionResolves: (() => void)[] | undefined;

function InAppBrowser({
  title, subtitle, url, theme, animationLevel,
}: StateProps) {
  const { closeBrowser } = getActions();

  const { hasOpenClass, hasShownClass } = useShowTransition(Boolean(url));

  const lang = useLang();

  const {
    inAppBrowserRef,
    bridgeInjectionCode,
    onMessage,
    disconnect,
  } = useDappBridge({
    endpoint: url,
  });

  const handleError = useLastCallback((err: any) => {
    logDebugError('inAppBrowser error', err);
  });

  const handleHideCompletion = useLastCallback(() => {
    for (const resolve of hideCompletionResolves || []) { resolve(); }
    hideCompletionResolves = undefined;
  });

  const handleBrowserClose = useLastCallback(async () => {
    if (IS_DELEGATING_BOTTOM_SHEET) {
      await BottomSheet.enable();
    }

    disconnect();
    inAppBrowser.removeEventListener('loaderror', handleError);
    inAppBrowser.removeEventListener('message', onMessage);
    inAppBrowser.removeEventListener('hidecompletion', handleHideCompletion);
    inAppBrowser = undefined;
    // eslint-disable-next-line no-null/no-null
    inAppBrowserRef.current = null;
    closeBrowser();
  });

  const openBrowser = useLastCallback(async () => {
    const browserTitle = !title && url ? getHostnameFromUrl(url) : title;
    const browserSubtitle = subtitle === browserTitle ? undefined : subtitle;

    const ADDITIONAL_INAPP_BROWSER_OPTIONS = `,${compact([
      IS_IOS || browserTitle ? `title=${browserTitle || ''}` : undefined,
      IS_IOS || browserSubtitle ? `subtitle=${browserSubtitle || ''}` : undefined,
      url ? `shareurl=${encodeURIComponent(url)}` : undefined,
      `closebuttoncaption=${IS_IOS ? lang('Close') : 'x'}`,
      `backbuttoncaption=${lang('Back')}`,
      `reloadcaption=${lang('Reload Page')}`,
      `openinbrowsercaption=${lang(IS_IOS ? 'Open in Safari' : 'Open in Browser')}`,
      `copyurlcaption=${lang('CopyURL')}`,
      `sharecaption=${lang('Share')}`,
      `theme=${theme}`,
      `animated=${animationLevel ?? ANIMATION_LEVEL_DEFAULT > 0 ? 'yes' : 'no'}`,
    ]).join(',')}`;
    inAppBrowser = cordova.InAppBrowser.open(url,
      '_blank',
      INAPP_BROWSER_OPTIONS + ADDITIONAL_INAPP_BROWSER_OPTIONS,
      bridgeInjectionCode);
    const originalHide = inAppBrowser.hide;
    inAppBrowser!.hide = () => {
      return new Promise<void>((resolve) => {
        originalHide?.();
        // On iOS, the animation takes some time. We have to ensure it's completed.
        if (IS_IOS_APP) {
          if (!hideCompletionResolves) hideCompletionResolves = [];
          hideCompletionResolves?.push(resolve);
        } else {
          resolve();
        }
      });
    };
    inAppBrowserRef.current = inAppBrowser;
    inAppBrowser.addEventListener('loaderror', handleError);
    inAppBrowser.addEventListener('message', onMessage);
    inAppBrowser.addEventListener('exit', handleBrowserClose);
    inAppBrowser.addEventListener('hidecompletion', handleHideCompletion);
    inAppBrowser.show();
  });

  useEffect(() => {
    if (!url) return;

    void openBrowser();
  }, [url, title, subtitle]);

  return (
    <div className={buildClassName(hasShownClass && styles.browserShown, hasOpenClass && styles.browserOpen)} />
  );
}

export default memo(withGlobal((global): StateProps => {
  const { currentBrowserOptions, settings } = global;

  return {
    url: currentBrowserOptions?.url,
    title: currentBrowserOptions?.title,
    subtitle: currentBrowserOptions?.subtitle,
    theme: settings.theme,
    animationLevel: settings.animationLevel,
  };
})(InAppBrowser));

export function getInAppBrowser(): CustomInAppBrowserObject | undefined {
  return inAppBrowser;
}
