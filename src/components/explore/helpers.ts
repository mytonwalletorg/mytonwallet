import { TONCONNECT_WALLET_JSBRIDGE_KEY } from '../../config';

export enum WebViewBridgeMessageType {
  invokeCapFunc = 'invokeCapFunc',
  functionResponse = 'functionResponse',
  event = 'event',
}

export interface WebViewBridgeMessage {
  type: string;
  invocationId: string;
  name: string;
  args: any[];
}

export type UseWebViewBridgeReturnType<Event> = [
  string,
  (e: MessageEvent) => void,
  (event: Event) => void,
];

export const objectToInjection = (obj: Record<string, any>, timeout?: number) => {
  const funcKeys = Object.keys(obj).filter((key) => typeof obj[key] === 'function');

  const funcs = funcKeys.reduce(
    (acc, funcName) => `${acc}${funcName}: (...args) => {
      return new Promise((resolve, reject) => window.invokeCapFunc('${funcName}', args, resolve, reject))
    },`,
    '',
  );

  return `
    (() => {
      if (!window.${TONCONNECT_WALLET_JSBRIDGE_KEY}) {
        window.capPromises = {};
        window.capEventListeners = [];
        window.invokeCapFunc = (name, args, resolve, reject) => {
          const invocationId = btoa(Math.random()).substring(0, 12);
          const timeoutMs = ${timeout || 'undefined'};
          const timeoutId = timeoutMs
            ? setTimeout(() => reject(new Error(\`bridge timeout for function with name: \${name}\`)), timeoutMs)
            : null;
          window.capPromises[invocationId] = { resolve, reject, timeoutId }
          webkit.messageHandlers.cordova_iab.postMessage(JSON.stringify({
            type: '${WebViewBridgeMessageType.invokeCapFunc}',
            invocationId: invocationId,
            name,
            args,
          }));
        };
        window.addEventListener('message', ({ data }) => {
          try {
            const message = JSON.parse(data);
            if (message.type === '${WebViewBridgeMessageType.functionResponse}') {
              const promise = window.capPromises[message.invocationId];
              if (!promise) {
                return;
              }
              if (promise.timeoutId) {
                clearTimeout(promise.timeoutId);
              }
              if (message.status === 'fulfilled') {
                promise.resolve(message.data);
              } else {
                promise.reject(new Error(message.data));
              }
              delete window.capPromises[message.invocationId];
            }
            if (message.type === '${WebViewBridgeMessageType.event}') {
              window.capEventListeners.forEach((listener) => listener(message.event));
            }
          } catch {}
        });
      }
      const listen = (cb) => {
        window.capEventListeners.push(cb);
        return () => {
          const index = window.capEventListeners.indexOf(cb);
          if (index > -1) {
            window.capEventListeners.splice(index, 1);
          }
        };
      };
      window.${TONCONNECT_WALLET_JSBRIDGE_KEY} = {
        tonconnect: Object.assign(
          ${JSON.stringify(obj)},
          {${funcs}},
          { listen },
        ),
      };
    })();
  `;
};

export const getInjectableJsMessage = (message: any) => {
  return `
    (function() {
      window.dispatchEvent(new MessageEvent('message', {
        data: ${JSON.stringify(message)}
      }));
    })();
  `;
};
