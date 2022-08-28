import type { OnApiUpdate } from '../../types';
import type { Methods, MethodArgs, MethodResponse } from '../../methods/types';

import { DEBUG } from '../../../config';
import { Connector, createConnector } from '../../../util/PostMessageConnector';

let connector: Connector;

export function initApi(onUpdate: OnApiUpdate) {
  if (!connector) {
    connector = createConnector(new Worker(new URL('./worker.ts', import.meta.url)), onUpdate);
  }

  return connector.init();
}

export function callApi<T extends keyof Methods>(fnName: T, ...args: MethodArgs<T>) {
  if (!connector) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.warn('API is not initialized');
    }

    return undefined;
  }

  const promise = connector.request({
    name: fnName,
    args,
  });

  return promise as MethodResponse<T>;
}
