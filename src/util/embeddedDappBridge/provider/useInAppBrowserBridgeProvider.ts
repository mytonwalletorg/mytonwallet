import type { ElementRef } from '../../../lib/teact/teact';
import { useEffect, useRef } from '../../../lib/teact/teact';

import { EMBEDDED_DAPP_BRIDGE_CHANNEL } from '../../../config';
import { createPostMessageInterface } from '../../createPostMessageInterface';
import { buildBridgeApi } from './bridgeApi';

import useLastCallback from '../../../hooks/useLastCallback';

import InAppBrowserPostMessageAdapter from './InAppBrowserPostMessageAdapter';

export function useInAppBrowserBridgeProvider(pageUrl?: string) {
  const cleanupRef = useRef<NoneToVoidFunction>();

  const setupDappBridge = useLastCallback((inAppBrowser: ElementRef<Cordova['InAppBrowser']>) => {
    cleanupRef.current = createPostMessageInterface(
      buildBridgeApi(pageUrl!),
      EMBEDDED_DAPP_BRIDGE_CHANNEL,
      new InAppBrowserPostMessageAdapter(inAppBrowser),
    );
  });

  useEffect(() => {
    if (!pageUrl) return;

    return () => {
      cleanupRef.current?.();
    };
  }, [pageUrl]);

  return {
    setupDappBridge,
    cleanupDappBridge: () => cleanupRef.current?.(),
  };
}
