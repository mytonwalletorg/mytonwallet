import Deferred from './Deferred';

export function createAbortableFunction<TArgs extends unknown[], TAbort, TFnResult>(
  toReturnOnAbort: TAbort,
  fn: (...args: TArgs) => Promise<TFnResult>,
): (...args: TArgs) => Promise<TAbort | TFnResult> {
  let abort = new Deferred<TAbort>();

  // eslint-disable-next-line func-names
  return function (...args: TArgs): Promise<TAbort | TFnResult> {
    abort.resolve(toReturnOnAbort); // "Cancels" the current function execution, if there is one

    abort = new Deferred<TAbort>();
    return Promise.race([fn(...args), abort.promise]);
  };
}
