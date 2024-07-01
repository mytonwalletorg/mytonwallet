import type { InAppBrowserObject } from '@awesome-cordova-plugins/in-app-browser';
import { useCallback, useMemo } from '../../../lib/teact/teact';

import type { WebViewBridgeMessage } from '../helpers';

import { openDeeplinkOrUrl } from '../../../util/deeplink';
import { getInjectableJsMessage, objectToInjection, WebViewBridgeMessageType } from '../helpers';

export type CustomInAppBrowserObject = Omit<InAppBrowserObject, 'hide'> & { hide: () => Promise<void> };

type UseWebViewBridgeReturnType<Event> = [
  string,
  (e: MessageEvent) => void,
  (event: Event) => void,
];

export const useWebViewBridge = <
  BridgeObject extends { [key: string]: any } = {},
  Event extends object = {},
>(
    inAppBrowserRef: React.RefObject<CustomInAppBrowserObject>,
    bridgeObj?: BridgeObject,
    timeout?: number,
  ): UseWebViewBridgeReturnType<Event> => {
  const bridgeInjectionCode = useMemo(
    () => (bridgeObj ? objectToInjection(bridgeObj, timeout) : ''),
    [bridgeObj, timeout],
  );

  const postMessage = useCallback((message: any) => {
    inAppBrowserRef.current?.executeScript({
      code: getInjectableJsMessage(JSON.stringify(message)),
    });
  }, [inAppBrowserRef]);

  const onMessage = useCallback(
    async (event: MessageEvent) => {
      if (!bridgeObj) return;

      const message = typeof event.data === 'string'
        ? JSON.parse(event.data)
        : event.data as WebViewBridgeMessage;

      if (message.type === WebViewBridgeMessageType.invokeCapFunc) {
        try {
          let result: any;
          switch (message.name) {
            case 'window:open': {
              const { url } = message.args;
              openDeeplinkOrUrl(url, true, true);
              result = true;
              break;
            }

            case 'window:close': {
              inAppBrowserRef.current?.close();

              break;
            }

            default: {
              const methodName = message.name.replace('bridge:', '');
              result = await bridgeObj[methodName](...message.args);
            }
          }

          postMessage({
            type: WebViewBridgeMessageType.functionResponse,
            invocationId: message.invocationId,
            status: 'fulfilled',
            data: result,
          });
        } catch (err: any) {
          postMessage({
            type: WebViewBridgeMessageType.functionResponse,
            invocationId: message.invocationId,
            status: 'rejected',
            data: err?.message,
          });
        }
      }
    },
    [bridgeObj, inAppBrowserRef, postMessage],
  );

  const sendEvent = useCallback(
    (event: any) => {
      postMessage({ type: WebViewBridgeMessageType.event, event });
    },
    [postMessage],
  );

  return [bridgeInjectionCode, onMessage, sendEvent];
};
