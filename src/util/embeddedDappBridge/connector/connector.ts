import type { DeviceInfo } from '@tonconnect/protocol';

import type { BridgeApi } from '../provider/bridgeApi';
import type { BrowserTonConnectBridgeMethods } from '../provider/tonConnectBridgeApi';

interface TonConnectProperties {
  deviceInfo: DeviceInfo;
  protocolVersion: number;
  isWalletBrowser: boolean;
}

type ApiMethodName = keyof BridgeApi;
type ApiArgs = Parameters<Required<BridgeApi>[ApiMethodName]>;
type ApiMethodResponse = ReturnType<Required<BridgeApi>[ApiMethodName]>;

interface RequestState {
  resolve: AnyToVoidFunction;
  reject: AnyToVoidFunction;
}

interface OutMessageData {
  channel: string;
  messageId: string;
  type: 'callMethod';
  name: ApiMethodName;
  args: ApiArgs;
}

type InMessageData = {
  channel: string;
  messageId: string;
  type: 'methodResponse';
  response?: ApiMethodResponse;
  error?: { message: string };
} | {
  channel: string;
  messageId: string;
  type: 'update';
  update: string;
};

type CordovaPostMessageTarget = { postMessage: AnyToVoidFunction };
type Handler = (update: string) => void;

/**
 * Allows calling functions, provided by another messenger (the parent window, or the Capacitor main view), in this messenger.
 * The other messenger must provide the functions using `createReverseIFrameInterface`.
 *
 * `PostMessageConnect` is not used here (as any other dependencies) because this needs to be easily stringified.
 */
export function initConnector(
  bridgeKey: string,
  channel: string,
  target: Window | CordovaPostMessageTarget,
  tonConnectProperties: TonConnectProperties,
) {
  if ((window as any)[bridgeKey]) return;

  const TON_CONNECT_BRIDGE_METHODS = ['connect', 'restoreConnection', 'disconnect', 'send'] as const;

  const requestStates = new Map<string, RequestState>();
  const updateHandlers = new Set<Handler>();

  setupPostMessageHandler();
  setupGlobalOverrides();
  initTonConnect();

  function setupPostMessageHandler() {
    window.addEventListener('message', ({ data }) => {
      const message = data as InMessageData;

      if (message.channel !== channel) {
        return;
      }

      if (message.type === 'methodResponse') {
        const requestState = requestStates.get(message.messageId);
        if (!requestState) return;

        requestStates.delete(message.messageId);

        if (message.error) {
          requestState.reject(message.error);
        } else {
          requestState.resolve(message.response);
        }
      } else if (message.type === 'update') {
        updateHandlers.forEach((handler) => handler(message.update));
      }
    });
  }

  function setupGlobalOverrides() {
    window.open = (url) => {
      url = sanitizeUrl(url);
      if (url) {
        void callApi('window:open', { url });
      }

      // eslint-disable-next-line no-null/no-null
      return null;
    };

    window.close = () => {
      void callApi('window:close');
    };

    window.addEventListener('click', (e) => {
      if (!(e.target instanceof HTMLElement)) return;

      const { href, target } = e.target.closest('a') || {};
      if (href && (target === '_blank' || !href.startsWith('http'))) {
        e.preventDefault();

        const url = sanitizeUrl(href);
        if (url) {
          void callApi('window:open', { url });
        }
      }
    }, false);
  }

  function initTonConnect() {
    const methods = Object.fromEntries(TON_CONNECT_BRIDGE_METHODS.map((name) => {
      return [
        name,
        (...args: Parameters<BrowserTonConnectBridgeMethods[typeof name]>) => callApi(`tonConnect:${name}`, ...args),
      ];
    }));

    function addUpdateHandler(cb: Handler) {
      updateHandlers.add(cb);

      return () => {
        updateHandlers.delete(cb);
      };
    }

    (window as any)[bridgeKey] = {
      tonconnect: {
        ...tonConnectProperties,
        ...methods,
        listen: addUpdateHandler,
      },
    };
  }

  function callApi<ApiMethodName extends keyof BridgeApi>(
    name: ApiMethodName,
    ...args: ApiArgs
  ) {
    const messageId = generateUniqueId();

    const promise = new Promise<any>((resolve, reject) => {
      requestStates.set(messageId, { resolve, reject });
    });

    const messageData: OutMessageData = {
      channel,
      messageId,
      type: 'callMethod',
      name,
      args,
    };

    if ('parent' in target) {
      target.postMessage(messageData, '*');
    } else {
      target.postMessage(JSON.stringify(messageData));
    }

    return promise;
  }

  function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  function sanitizeUrl(url?: string | URL) {
    if (!url) return undefined;

    // eslint-disable-next-line no-control-regex
    url = String(url).trim().replace(/[\x00-\x1F\x7F]/g, '');

    if (url.startsWith('//')) {
      return `https:${url}`;
    }

    const UNSAFE_PATTERNS = [
      /^\s*javascript\s*:/i,
      /^\s*data\s*:/i,
      /^\s*vbscript\s*:/i,
      /^\s*file\s*:/i,
      /^\s*about\s*:/i,
      /^\s*blob\s*:/i,
      /^\s*filesystem\s*:/i,
      /^\s*chrome(-extension)?\s*:/i,
      /^\s*moz-extension\s*:/i,
      /^\s*ms-browser-extension\s*:/i,
    ];

    if (UNSAFE_PATTERNS.some((p) => p.test(url))) {
      return undefined;
    }

    if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) {
      return undefined;
    }

    return url;
  }
}

export const initConnectorString = initConnector.toString();
