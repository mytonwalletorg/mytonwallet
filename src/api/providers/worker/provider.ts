import type {
  MethodArgs, Methods,
} from '../../methods/types';
import type { TonConnectMethodArgs, TonConnectMethods } from '../../tonConnect/types/misc';
import type {
  ApiInitArgs, OnApiUpdate,
} from '../../types';

import { createPostMessageInterface } from '../../../util/createPostMessageInterface';
import * as methods from '../../methods';
import init from '../../methods/init';
import * as tonConnectApi from '../../tonConnect';

createPostMessageInterface((name: string, origin?: string, ...args: any[]) => {
  if (name === 'init') {
    return init(args[0] as OnApiUpdate, args[1] as ApiInitArgs);
  } else {
    if (name.startsWith('tonConnect_')) {
      name = name.replace('tonConnect_', '');
      const method = tonConnectApi[name as keyof TonConnectMethods];
      // @ts-ignore
      return method(...args as TonConnectMethodArgs<keyof TonConnectMethods>);
    }

    const method = methods[name as keyof Methods];

    // @ts-ignore
    return method(...args as MethodArgs<keyof Methods>);
  }
});
