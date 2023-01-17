import type { ApiInitArgs, OnApiUpdate } from '../../types';
import type { Methods, MethodArgs } from '../../methods/types';

import { StorageType } from '../../storages/types';
import { POPUP_PORT } from '../../../extension/config';
import { createExtensionInterface } from '../../../util/createPostMessageInterface';

import init from '../../methods/init';
import * as methods from '../../methods';
import { disconnectUpdater } from '../../common/helpers';

createExtensionInterface(POPUP_PORT, (name: string, ...args: any[]) => {
  if (name === 'init') {
    return init(args[0] as OnApiUpdate, args[1] as ApiInitArgs, StorageType.IndexedDb);
  } else {
    const method = methods[name as keyof Methods];
    // @ts-ignore
    return method(...args as MethodArgs<keyof Methods>);
  }
}, undefined, disconnectUpdater);
