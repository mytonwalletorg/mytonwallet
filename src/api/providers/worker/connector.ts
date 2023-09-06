import type { AllMethodArgs, AllMethodResponse, AllMethods } from '../../types/methods';
import type { ApiInitArgs, OnApiUpdate } from '../../types';

import { logDebugError } from '../../../util/logs';
import type { Connector } from '../../../util/PostMessageConnector';
import { createConnector } from '../../../util/PostMessageConnector';

let connector: Connector;

export function initApi(onUpdate: OnApiUpdate, initArgs: ApiInitArgs | (() => ApiInitArgs)) {
  if (!connector) {
    connector = createConnector(new Worker(
      /* webpackChunkName: "worker" */ new URL('./provider.ts', import.meta.url),
    ), onUpdate);
  }

  const args = typeof initArgs === 'function' ? initArgs() : initArgs;
  return connector.init(args);
}

export async function callApi<T extends keyof AllMethods>(fnName: T, ...args: AllMethodArgs<T>) {
  if (!connector) {
    logDebugError('API is not initialized');
    return undefined;
  }

  try {
    return await (connector.request({
      name: fnName,
      args,
    }) as AllMethodResponse<T>);
  } catch (err) {
    logDebugError('callApi', err);
    return undefined;
  }
}
