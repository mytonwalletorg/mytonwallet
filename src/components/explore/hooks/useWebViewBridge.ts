import type { InAppBrowserObject } from '@awesome-cordova-plugins/in-app-browser';
import { useCallback, useMemo } from '../../../lib/teact/teact';

import type { WebViewBridgeMessage } from '../helpers';

import { getInjectableJsMessage, objectToInjection, WebViewBridgeMessageType } from '../helpers';

type UseWebViewBridgeReturnType<Event> = [
  string,
  (e: MessageEvent) => void,
  (event: Event) => void,
];

export const useWebViewBridge = <
  BridgeObject extends { [key: string]: any } = {},
  Event extends object = {},
>(
    inAppBrowserRef: React.RefObject<InAppBrowserObject>,
    bridgeObj: BridgeObject,
    timeout?: number,
  ): UseWebViewBridgeReturnType<Event> => {
  const bridgeInjectionCode = useMemo(
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
          let result: any;
          switch (message.name) {
            case 'window:open': {
              const { url, target, options } = message.args;

              window.open(url, target, options);
              result = true;
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
    [bridgeObj, postMessage],
  );

  const sendEvent = useCallback(
    (event: any) => {
      postMessage({ type: WebViewBridgeMessageType.event, event });
    },
    [postMessage],
  );

  return [bridgeInjectionCode, onMessage, sendEvent];
};
