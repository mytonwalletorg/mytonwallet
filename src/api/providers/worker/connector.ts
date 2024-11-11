import type { Connector } from '../../../util/PostMessageConnector';
import type { ApiInitArgs, OnApiUpdate } from '../../types';
import type { AllMethodArgs, AllMethodResponse, AllMethods } from '../../types/methods';

import { IS_CAPACITOR } from '../../../config';
import { createWindowProvider } from '../../../util/capacitorStorageProxy';
import { logDebugApi, logDebugError } from '../../../util/logs';
import { createConnector } from '../../../util/PostMessageConnector';
import { pause } from '../../../util/schedulers';
import { IS_IOS } from '../../../util/windowEnvironment';

const HEALTH_CHECK_TIMEOUT = 150;
const HEALTH_CHECK_MIN_DELAY = 5000; // 5 sec

let updateCallback: OnApiUpdate;
let worker: Worker | undefined;
let connector: Connector | undefined;
let isInitialized = false;

export function initApi(onUpdate: OnApiUpdate, initArgs: ApiInitArgs | (() => ApiInitArgs)) {
  updateCallback = onUpdate;

  if (!connector) {
    worker = new Worker(
      /* webpackChunkName: "worker" */ new URL('./provider.ts', import.meta.url),
    );
    connector = createConnector(worker, onUpdate);

    if (IS_CAPACITOR) {
      createWindowProvider(worker!);
    }
  }

  if (!isInitialized) {
    if (IS_IOS) {
      setupIosHealthCheck();
    }
    isInitialized = true;
  }

  const args = typeof initArgs === 'function' ? initArgs() : initArgs;
  return connector.init(args);
}

export async function callApi<T extends keyof AllMethods>(fnName: T, ...args: AllMethodArgs<T>) {
  if (!connector) {
    logDebugError('API is not initialized');
    return undefined;
  }

  try {
    const result = await (connector.request({
      name: fnName,
      args,
    }) as AllMethodResponse<T>);

    logDebugApi(`callApi: ${fnName}`, args, result);

    return result;
  } catch (err) {
    return undefined;
  }
}

export function callApiWithThrow<T extends keyof AllMethods>(fnName: T, ...args: AllMethodArgs<T>) {
  return (connector!.request({
    name: fnName,
    args,
  }) as AllMethodResponse<T>);
}

const startedAt = Date.now();

// Workaround for iOS sometimes stops interacting with worker
function setupIosHealthCheck() {
  window.addEventListener('focus', () => {
    void ensureWorkerPing();
    // Sometimes a single check is not enough
    setTimeout(() => ensureWorkerPing(), 1000);
  });
}

async function ensureWorkerPing() {
  let isResolved = false;

  try {
    await Promise.race([
      callApiWithThrow('ping'),
      pause(HEALTH_CHECK_TIMEOUT)
        .then(() => (isResolved ? undefined : Promise.reject(new Error('HEALTH_CHECK_TIMEOUT')))),
    ]);
  } catch (err) {
    logDebugError('ensureWorkerPing', err);

    if (Date.now() - startedAt >= HEALTH_CHECK_MIN_DELAY) {
      worker?.terminate();
      worker = undefined;
      connector = undefined;
      updateCallback({ type: 'requestReconnectApi' });
    }
  } finally {
    isResolved = true;
  }
}
