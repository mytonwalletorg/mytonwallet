import { BottomSheet } from 'native-bottom-sheet';
import React, { memo, useEffect, useMemo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiDapp } from '../../api/types';

import { selectCurrentAccountState } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { INAPP_BROWSER_OPTIONS } from '../../util/capacitor';
import { logDebugError } from '../../util/logs';
import { pause } from '../../util/schedulers';
import { IS_DELEGATING_BOTTOM_SHEET } from '../../util/windowEnvironment';

import useLastCallback from '../../hooks/useLastCallback';
import useShowTransition from '../../hooks/useShowTransition';
import { useDappBridge } from '../explore/hooks/useDappBridge';

import styles from './InAppBrowser.module.scss';

interface StateProps {
  url?: string;
  dapps?: ApiDapp[];
}

const REINJECTION_DELAY = 3000;

let inAppBrowser: Cordova['InAppBrowser'] | undefined;

function InAppBrowser({ url, dapps }: StateProps) {
  const { closeBrowser } = getActions();

  const { hasOpenClass, hasShownClass } = useShowTransition(Boolean(url));

  const isConnected = useMemo(() => {
    if (!url) return false;

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
  });

  const handleLoadStart = useLastCallback(async () => {
    inAppBrowser.executeScript({
      code: bridgeInjectionCode,
    });

    await pause(REINJECTION_DELAY);
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
    closeBrowser();
  });

  const openBrowser = useLastCallback(async () => {
    if (IS_DELEGATING_BOTTOM_SHEET) {
      await BottomSheet.disable();
    }

    inAppBrowser = cordova.InAppBrowser.open(url, '_blank', INAPP_BROWSER_OPTIONS);
    inAppBrowserRef.current = inAppBrowser;
    inAppBrowser.addEventListener('loadstart', handleLoadStart);
    inAppBrowser.addEventListener('loadstop', handleInjectJsBridge);
    inAppBrowser.addEventListener('loaderror', handleError);
    inAppBrowser.addEventListener('message', onMessage);
    inAppBrowser.addEventListener('exit', handleBrowserClose);
    inAppBrowser.show();
  });

  useEffect(() => {
    if (!url) return;

    void openBrowser();
  }, [url]);

  return (
    <div className={buildClassName(hasShownClass && styles.browserShown, hasOpenClass && styles.browserOpen)} />
  );
}

export default memo(withGlobal((global): StateProps => {
  const { currentBrowserUrl } = selectCurrentAccountState(global) || {};

  return {
    dapps: global.settings.dapps,
    url: currentBrowserUrl,
  };
})(InAppBrowser));

export function getInAppBrowser(): Cordova['InAppBrowser'] | undefined {
  return inAppBrowser;
}
