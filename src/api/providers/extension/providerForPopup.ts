import { StorageType } from '../../storages/types';
import type { MethodArgs, Methods } from '../../methods/types';
import type { ApiInitArgs, OnApiUpdate } from '../../types';

import { POPUP_PORT } from './config';
import { createExtensionInterface } from '../../../util/createPostMessageInterface';
import { disconnectUpdater } from '../../common/helpers';
import * as methods from '../../methods';
import init from '../../methods/init';

createExtensionInterface(POPUP_PORT, (name: string, origin?: string, ...args: any[]) => {
  if (name === 'init') {
    return init(args[0] as OnApiUpdate, args[1] as ApiInitArgs, StorageType.ExtensionLocal);
  } else {
    const method = methods[name as keyof Methods];
    // @ts-ignore
    return method(...args as MethodArgs<keyof Methods>);
  }
}, undefined, disconnectUpdater);
