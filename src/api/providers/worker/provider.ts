import type {
  MethodArgs, Methods,
} from '../../methods/types';
import type {
  ApiInitArgs, OnApiUpdate,
} from '../../types';

import { createWorkerInterface } from '../../../util/createPostMessageInterface';
import * as methods from '../../methods';
import init from '../../methods/init';

createWorkerInterface((name: string, origin?: string, ...args: any[]) => {
  if (name === 'init') {
    return init(args[0] as OnApiUpdate, args[1] as ApiInitArgs);
  } else {
    const method = methods[name as keyof Methods];

    // @ts-ignore
    return method(...args as MethodArgs<keyof Methods>);
  }
});
