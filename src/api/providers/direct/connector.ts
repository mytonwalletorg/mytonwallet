import type { TonConnectMethodArgs, TonConnectMethods } from '../../tonConnect/types/misc';
import type { ApiInitArgs, OnApiUpdate } from '../../types';
import type { AllMethodArgs, AllMethodResponse, AllMethods } from '../../types/methods';

import * as methods from '../../methods';
import init from '../../methods/init';
import * as tonConnectApi from '../../tonConnect';

export function initApi(onUpdate: OnApiUpdate, initArgs: ApiInitArgs | (() => ApiInitArgs)) {
  const args = typeof initArgs === 'function' ? initArgs() : initArgs;
  void init(onUpdate, args);
}

export function callApi<T extends keyof AllMethods>(fnName: T, ...args: AllMethodArgs<T>): AllMethodResponse<T> {
  if (fnName.startsWith('tonConnect_')) {
    fnName = fnName.replace('tonConnect_', '') as T;
    const method = tonConnectApi[fnName as keyof TonConnectMethods];
    // @ts-ignore
    return method(...args as TonConnectMethodArgs<keyof TonConnectMethods>);
  }
  // @ts-ignore
  return methods[fnName](...args) as AllMethodResponse<T>;
}
