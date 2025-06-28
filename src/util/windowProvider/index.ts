import { WINDOW_PROVIDER_CHANNEL, WINDOW_PROVIDER_PORT } from '../../config';
import { createPostMessageInterface, createReverseExtensionInterface } from '../createPostMessageInterface';
import * as windowMethods from './methods';

export function createWindowProvider(worker: Worker) {
  createPostMessageInterface(windowMethods, WINDOW_PROVIDER_CHANNEL, worker, true);
}

export function createWindowProviderForExtension() {
  createReverseExtensionInterface(WINDOW_PROVIDER_PORT, windowMethods);
}
