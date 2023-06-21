import type { MethodArgs, MethodResponse, Methods } from '../../methods/types';
import type { ApiInitArgs, OnApiUpdate } from '../../types';

import { logDebugError } from '../../../util/logs';
import type { Connector } from '../../../util/PostMessageConnector';
import { createExtensionConnector } from '../../../util/PostMessageConnector';
// Relative import is needed for `NormalModuleReplacementPlugin`
// eslint-disable-next-line import/no-useless-path-segments
import { POPUP_PORT } from '../extension/config';

let connector: Connector;

export function initApi(onUpdate: OnApiUpdate, initArgs: ApiInitArgs | (() => ApiInitArgs)) {
  if (!connector) {
    const getInitArgs = typeof initArgs === 'function' ? initArgs : () => initArgs;
    connector = createExtensionConnector(POPUP_PORT, onUpdate, getInitArgs);
  }
}

export function callApi<T extends keyof Methods>(methodName: T, ...args: MethodArgs<T>) {
  if (!connector) {
    logDebugError('API is not initialized');
    return undefined;
  }

  const promise = connector.request({
    name: methodName,
    args,
  });

  return promise as MethodResponse<T>;
}
