import type { ApiInitArgs, OnApiUpdate } from '../../types';
import type { Methods, MethodArgs } from '../../methods/types';

import { StorageType } from '../../storages/types';
import { createWorkerInterface } from '../../../util/createPostMessageInterface';

import init from '../../methods/init';
import * as methods from '../../methods';

createWorkerInterface((name: string, ...args: any[]) => {
  if (name === 'init') {
    return init(args[0] as OnApiUpdate, args[1] as ApiInitArgs, StorageType.IndexedDb);
  } else {
    const method = methods[name as keyof Methods];

    // @ts-ignore
    return method(...args as MethodArgs<keyof Methods>);
  }
});
