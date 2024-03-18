import { BottomSheet } from 'native-bottom-sheet';
import React, { memo, useMemo } from '../../lib/teact/teact';

import type { ApiDapp } from '../../api/types';

import { IS_CAPACITOR } from '../../config';
import buildClassName from '../../util/buildClassName';
import { INAPP_BROWSER_OPTIONS } from '../../util/capacitor';
import { logDebugError } from '../../util/logs';
import { pause } from '../../util/schedulers';
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

const FIRST_INJECTION_DELAY = 2500;
const SECOND_INJECTION_DELAY = 10000;

let inAppBrowser: Cordova['InAppBrowser'] | undefined;

function DappSite({
  url, icon, title, description, isExternal, dapps,
}: OwnProps) {
  const [isOpen, markIsOpen, unmarkIsOpen] = useFlag(false);
  const { hasOpenClass, hasShownClass } = useShowTransition(isOpen);

  const isConnected = useMemo(() => {
    const origin = new URL(url).origin.toLowerCase();
    return dapps?.some((dapp) => dapp.origin === origin);
  }, [dapps, url]);

  const {
    inAppBrowserRef,
    bridgeInjectionCode,
    onMessage,
    disconnect,
  } = useDappBridge({
    endpoint: url,
    isConnected,
    onShowBrowser: markIsOpen,
    onHideBrowser: unmarkIsOpen,
  });

  const handleLoadStart = useLastCallback(async () => {
    await pause(FIRST_INJECTION_DELAY);
    if (!inAppBrowser) return;

    inAppBrowser.executeScript({
      code: bridgeInjectionCode,
    });
    await pause(SECOND_INJECTION_DELAY);
    if (!inAppBrowser) return;

    inAppBrowser.executeScript({
      code: bridgeInjectionCode,
    });
  });

  const handleInjectJsBridge = useLastCallback(() => {
    if (!inAppBrowser) return;

    inAppBrowser.executeScript({
      code: bridgeInjectionCode,
    });
  });

  const handleError = useLastCallback((err: any) => {
    logDebugError('inAppBrowser error', err);
  });

  const handleBrowserClose = useLastCallback(async () => {
    if (IS_DELEGATING_BOTTOM_SHEET) {
      await BottomSheet.enable();
    }

    disconnect();
    inAppBrowser.removeEventListener('loadstart', handleLoadStart);
    inAppBrowser.removeEventListener('loadstop', handleInjectJsBridge);
    inAppBrowser.removeEventListener('loaderror', handleError);
    inAppBrowser.removeEventListener('message', onMessage);
    inAppBrowser = undefined;
    // eslint-disable-next-line no-null/no-null
    inAppBrowserRef.current = null;
    unmarkIsOpen();
  });

  const handleClick = useLastCallback(async () => {
    if (!IS_CAPACITOR || isExternal) {
      window.open(url, '_blank', 'noopener');
    }

    if (IS_DELEGATING_BOTTOM_SHEET) {
      await BottomSheet.disable();
    }

    markIsOpen();
    inAppBrowser = cordova.InAppBrowser.open(url, '_blank', INAPP_BROWSER_OPTIONS);
    inAppBrowserRef.current = inAppBrowser;
    inAppBrowser.addEventListener('loadstart', handleLoadStart);
    inAppBrowser.addEventListener('loadstop', handleInjectJsBridge);
    inAppBrowser.addEventListener('loaderror', handleError);
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

export function getInAppBrowser(): Cordova['InAppBrowser'] | undefined {
  return inAppBrowser;
}
