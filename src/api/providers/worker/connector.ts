import type { Connector } from '../../../util/PostMessageConnector';
import type { ApiInitArgs, OnApiUpdate } from '../../types';
import type { AllMethodArgs, AllMethodResponse, AllMethods } from '../../types/methods';

import { IS_CAPACITOR } from '../../../config';
import { createWindowProvider } from '../../../util/capacitorStorageProxy';
import { logDebugError } from '../../../util/logs';
import { createConnector } from '../../../util/PostMessageConnector';

let connector: Connector;

export function initApi(onUpdate: OnApiUpdate, initArgs: ApiInitArgs | (() => ApiInitArgs)) {
  if (!connector) {
    const worker = new Worker(
      /* webpackChunkName: "worker" */ new URL('./provider.ts', import.meta.url),
    );
    connector = createConnector(worker, onUpdate);

    if (IS_CAPACITOR) {
      createWindowProvider(worker);
    }
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
    return undefined;
  }
}
