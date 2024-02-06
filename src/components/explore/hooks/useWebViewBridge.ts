import type { InAppBrowserObject } from '@awesome-cordova-plugins/in-app-browser';
import { useCallback, useMemo } from '../../../lib/teact/teact';

import type { UseWebViewBridgeReturnType, WebViewBridgeMessage } from '../helpers';

import { getInjectableJsMessage, objectToInjection, WebViewBridgeMessageType } from '../helpers';

export const useWebViewBridge = <
  BridgeObject extends { [key: string]: any } = {},
  Event extends object = {},
>(
    inAppBrowserRef: React.RefObject<InAppBrowserObject>,
    bridgeObj: BridgeObject,
    timeout?: number,
  ): UseWebViewBridgeReturnType<Event> => {
  const injectedJavaScriptBeforeContentLoaded = useMemo(
    () => objectToInjection(bridgeObj, timeout),
    [bridgeObj, timeout],
  );

  const postMessage = useCallback((message: any) => {
    inAppBrowserRef.current?.executeScript({
      code: getInjectableJsMessage(JSON.stringify(message)),
    });
  }, [inAppBrowserRef]);

  const onMessage = useCallback(
    async (event: MessageEvent) => {
      const message = typeof event.data === 'string'
        ? JSON.parse(event.data)
        : event.data as WebViewBridgeMessage;

      if (message.type === WebViewBridgeMessageType.invokeCapFunc) {
        try {
          const result = await bridgeObj[message.name](...message.args);

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
    [bridgeObj, postMessage],
  );

  const sendEvent = useCallback(
    (event: any) => {
      postMessage({ type: WebViewBridgeMessageType.event, event });
    },
    [postMessage],
  );

  return [injectedJavaScriptBeforeContentLoaded, onMessage, sendEvent];
};
