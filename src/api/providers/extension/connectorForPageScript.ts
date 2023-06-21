import type { OnApiDappUpdate } from '../../types/dappUpdates';
import type {
  DappMethodResponse, DappMethods, LegacyDappMethodResponse,
  LegacyDappMethods,
} from '../../dappMethods/types';

import { PAGE_CONNECTOR_CHANNEL } from './config';
import { logDebugError } from '../../../util/logs';
import type { Connector } from '../../../util/PostMessageConnector';
import { createConnector } from '../../../util/PostMessageConnector';

let connector: Connector;

type Methods = DappMethods & LegacyDappMethods;
type MethodResponse<T extends keyof Methods> = (
  T extends keyof DappMethods
    ? DappMethodResponse<T>
    : T extends keyof LegacyDappMethods
      ? LegacyDappMethodResponse<T>
      : never
  );

export function initApi(onUpdate: OnApiDappUpdate) {
  connector = createConnector(window, onUpdate, PAGE_CONNECTOR_CHANNEL, window.location.href);
  return connector;
}

export function callApi<T extends keyof Methods>(methodName: T, ...args: any[]) {
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
