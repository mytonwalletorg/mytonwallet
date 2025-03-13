import type { Connector } from '../PostMessageConnector';
import type { WindowMethodArgs, WindowMethodResponse, WindowMethods } from './types';

import { WINDOW_PROVIDER_CHANNEL } from '../../config';

import { createConnector } from '../PostMessageConnector';

let connector: Connector;

export function initWindowConnector() {
  if (!connector) {
    // eslint-disable-next-line no-restricted-globals
    connector = createConnector(self as DedicatedWorkerGlobalScope, undefined, WINDOW_PROVIDER_CHANNEL);
    connector.init();
  }
}

// eslint-disable-next-line no-async-without-await/no-async-without-await
export function callWindow<T extends keyof WindowMethods>(methodName: T, ...args: WindowMethodArgs<T>) {
  if (!connector) {
    throw new Error('API is not initialized');
  }

  return connector.request({ name: methodName, args }) as EnsurePromise<WindowMethodResponse<T>>;
}
