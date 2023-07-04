import generateUniqueId from '../../util/generateUniqueId';
import { ApiUserRejectsError } from '../errors';

const deferreds = new Map<string, Deferred>();

class Deferred<T = any> {
  resolve!: AnyToVoidFunction;

  reject!: AnyToVoidFunction;

  promise = new Promise<T>((resolve, reject) => {
    this.resolve = resolve;
    this.reject = reject;
  });
}

export function createDappPromise(promiseId = generateUniqueId()) {
  const deferred = new Deferred();

  deferreds.set(promiseId, deferred);

  const { promise } = deferred;

  return { promiseId, promise };
}

export function resolveDappPromise(promiseId: string, value?: any) {
  const deferred = deferreds.get(promiseId);
  if (!deferred) {
    return;
  }

  deferred.resolve(value);
  deferreds.delete(promiseId);
}

export function rejectDappPromise(promiseId: string, reason: string = 'Unknown rejection reason') {
  const deferred = deferreds.get(promiseId);
  if (!deferred) {
    return;
  }

  deferred.reject(new ApiUserRejectsError(reason));
  deferreds.delete(promiseId);
}

export function rejectAllDappPromises(message: string) {
  Array.from(deferreds.keys()).forEach((id) => {
    rejectDappPromise(id, message);
  });
}
