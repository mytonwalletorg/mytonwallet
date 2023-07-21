import type { MethodArgs, MethodResponse, Methods } from '../../methods/types';
import type { ApiInitArgs, OnApiUpdate } from '../../types';

import * as methods from '../../methods';
import init from '../../methods/init';

// eslint-disable-next-line no-restricted-globals
export function initApi(onUpdate: OnApiUpdate, initArgs: ApiInitArgs | (() => ApiInitArgs)) {
  const args = typeof initArgs === 'function' ? initArgs() : initArgs;
  init(onUpdate, args);
}

export function callApi<T extends keyof Methods>(fnName: T, ...args: MethodArgs<T>): MethodResponse<T> {
  // @ts-ignore
  return methods[fnName](...args) as MethodResponse<T>;
}
