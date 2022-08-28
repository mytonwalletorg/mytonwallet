import type { OnApiUpdate } from '../../types';
import type { Methods, MethodArgs } from '../../methods/types';

import { StorageType } from '../../storages/types';
import { POPUP_PORT } from '../../../extension/config';
import { createExtensionInterface } from '../../../util/createPostMessageInterface';

import init from '../../methods/init';
import * as methods from '../../methods';

createExtensionInterface(POPUP_PORT, (name: string, ...args: any[]) => {
  const method = methods[name as keyof Methods];
  // @ts-ignore
  return method(...args as MethodArgs<keyof Methods>);
}, undefined, (onUpdate: OnApiUpdate) => {
  init(onUpdate, StorageType.IndexedDb);
});
