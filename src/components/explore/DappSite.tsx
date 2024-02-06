import type { InAppBrowserEvent } from '@awesome-cordova-plugins/in-app-browser';
import { BottomSheet } from 'native-bottom-sheet';
import React, { memo, useMemo } from '../../lib/teact/teact';

import type { ApiDapp } from '../../api/types';

import { APP_NAME, IS_CAPACITOR } from '../../config';
import buildClassName from '../../util/buildClassName';
import { logDebugError } from '../../util/logs';
import { IS_DELEGATING_BOTTOM_SHEET } from '../../util/windowEnvironment';

import useFlag from '../../hooks/useFlag';
import useLastCallback from '../../hooks/useLastCallback';
import useShowTransition from '../../hooks/useShowTransition';
import { useDappBridge } from './hooks/useDappBridge';

import Image from '../ui/Image';

import styles from '../main/sections/Content/Explore.module.scss';

interface OwnProps {
  url: string;
  icon: string;
  title: string;
  description: string;
  isExternal: boolean;
  dapps?: ApiDapp[];
}

let inAppBrowser: Cordova['InAppBrowser'] | undefined;
const UTM_PARAM = `utm_source=${encodeURIComponent(APP_NAME.toLowerCase())}`;
// Full list of options can be found at https://github.com/apache/cordova-plugin-inappbrowser#cordovainappbrowseropen
const BROWSER_OPTIONS = [
  'location=no',
  'hidden=yes',
  'beforeload=yes',
  'toolbarposition=top',
  'hidenavigationbuttons=yes',
  'hideurlbar=yes',
  'closebuttoncaption=✕',
  'allowInlineMediaPlayback=yes',
].join(',');

function DappSite({
  url, icon, title, description, isExternal, dapps,
}: OwnProps) {
  const [isOpen, markIsOpen, unmarkIsOpen] = useFlag(false);
  const { hasOpenClass, hasShownClass } = useShowTransition(isOpen);

  const isConnected = useMemo(() => {
    const origin = new URL(url).origin.toLowerCase();
    return dapps?.some((dapp) => dapp.origin === origin);
  }, [dapps, url]);

  const handleBeforeLoadCallback = useLastCallback((e: InAppBrowserEvent, cb: (url: string) => void) => {
    if (e.url.startsWith(url)) {
      cb(url);
    } else {
      logDebugError('Unexpected URL', e.url);
    }
  });

  const {
    inAppBrowserRef,
    injectedJavaScriptBeforeContentLoaded,
    onMessage,
    disconnect,
  } = useDappBridge({
    endpoint: url,
    isConnected,
    onShowBrowser: markIsOpen,
    onHideBrowser: unmarkIsOpen,
  });

  const handleOnLoad = useLastCallback(() => {
    if (!inAppBrowser) return;

    inAppBrowser.executeScript({
      code: injectedJavaScriptBeforeContentLoaded,
    });
  });

  const handleError = useLastCallback((err: any) => {
    const scriptErrorMessage = 'window.alert(\'Sorry we cannot open that page. Server error.\');';
    inAppBrowser.executeScript({ code: scriptErrorMessage });
    inAppBrowser.close();

    logDebugError('inAppBrowser error', err);
  });

  const handleBrowserClose = useLastCallback(async () => {
    if (IS_DELEGATING_BOTTOM_SHEET) {
      await BottomSheet.enable();
    }

    disconnect();
    inAppBrowser.removeEventListener('loadstop', handleOnLoad);
    inAppBrowser.removeEventListener('loaderror', handleError);
    inAppBrowser.removeEventListener('beforeload', handleBeforeLoadCallback);
    inAppBrowser.removeEventListener('message', onMessage);
    inAppBrowser = undefined;
    // eslint-disable-next-line no-null/no-null
    inAppBrowserRef.current = null;
    unmarkIsOpen();
  });

  const handleClick = useLastCallback(async () => {
    const finalUrl = url.includes('utm_source=')
      ? url
      : url.includes('?')
        ? `${url}&${UTM_PARAM}`
        : `${url}?${UTM_PARAM}`;

    if (!IS_CAPACITOR || isExternal) {
      window.open(finalUrl, '_blank', 'noopener');
      return;
    }

    if (IS_DELEGATING_BOTTOM_SHEET) {
      await BottomSheet.disable();
    }

    markIsOpen();
    inAppBrowser = cordova.InAppBrowser.open(url, '_blank', BROWSER_OPTIONS);
    inAppBrowserRef.current = inAppBrowser;
    inAppBrowser.addEventListener('loadstop', handleOnLoad);
    inAppBrowser.addEventListener('loaderror', handleError);
    inAppBrowser.addEventListener('beforeload', handleBeforeLoadCallback);
    inAppBrowser.addEventListener('message', onMessage);
    inAppBrowser.addEventListener('exit', handleBrowserClose);
    inAppBrowser.show();
  });

  return (
    <div
      className={buildClassName(styles.item, hasShownClass && styles.itemShown, hasOpenClass && styles.itemOpen)}
      tabIndex={0}
      role="button"
      onClick={handleClick}
    >
      <Image url={icon} className={styles.imageWrapper} imageClassName={styles.image} />
      <div className={styles.infoWrapper}>
        <b className={styles.title}>{title}</b>
      </div>
      <div className={styles.description}>{description}</div>
    </div>
  );
}

export default memo(DappSite);
