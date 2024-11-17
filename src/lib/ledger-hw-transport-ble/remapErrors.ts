import {
  DisconnectedDevice,
} from '@ledgerhq/errors';

export type IOBleErrorRemap = Error | null | undefined;

export const remapError = (error: IOBleErrorRemap): IOBleErrorRemap => {
  if (!error || !error.message) return error;

  if (error.message.includes('was disconnected') || error.message.includes('not found')) {
    return new DisconnectedDevice();
  }

  return error;
};

export const rethrowError = (e: Error | null | undefined): never => {
  // throw remapError(e);
  throw e ?? new Error();
};

export const decoratePromiseErrors = <A>(promise: Promise<A>): Promise<A> => promise.catch(rethrowError);
