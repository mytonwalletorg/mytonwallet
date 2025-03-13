import type { WindowMethods } from './types';

import { WINDOW_PROVIDER_CHANNEL } from '../../config';
import { createPostMessageInterface } from '../createPostMessageInterface';
import * as windowMethods from './methods';

export function createWindowProvider(worker: Worker) {
  createPostMessageInterface((name: string, origin?: string, ...args: any[]) => {
    const method = windowMethods[name as keyof WindowMethods];

    // @ts-ignore
    return method(...args as WindowMethodArgs<keyof WindowMethods>);
  }, WINDOW_PROVIDER_CHANNEL, worker, true);
}
