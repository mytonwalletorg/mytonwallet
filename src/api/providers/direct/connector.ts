import type { ApiInitArgs, OnApiUpdate } from '../../types';
import type { AllMethodArgs, AllMethodResponse, AllMethods } from '../../types/methods';

import * as methods from '../../methods';
import init from '../../methods/init';

// eslint-disable-next-line no-restricted-globals
export function initApi(onUpdate: OnApiUpdate, initArgs: ApiInitArgs | (() => ApiInitArgs)) {
  const args = typeof initArgs === 'function' ? initArgs() : initArgs;
  init(onUpdate, args);
}

export function callApi<T extends keyof AllMethods>(fnName: T, ...args: AllMethodArgs<T>): AllMethodResponse<T> {
  // @ts-ignore
  return methods[fnName](...args) as AllMethodResponse<T>;
}
