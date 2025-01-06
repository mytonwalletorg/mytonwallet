import Deferred from './Deferred';

export function createAbortableFunction<TArgs extends unknown[], TAbort, TFnResult>(
  toReturnOnAbort: TAbort,
  fn: (...args: TArgs) => Promise<TFnResult>,
): (...args: TArgs) => Promise<TAbort | TFnResult> {
  let abort = new Deferred<TAbort>();

  return function abortableFunction(...args: TArgs): Promise<TAbort | TFnResult> {
    abort.resolve(toReturnOnAbort);

    abort = new Deferred<TAbort>();
    return Promise.race([fn(...args), abort.promise]);
  };
}
