// eslint-disable-next-line max-classes-per-file
import type { ApiAnyDisplayError } from './types';

export class ApiBaseError extends Error {
  constructor(message?: string, public displayError?: ApiAnyDisplayError) {
    super(message);
    Error.captureStackTrace(this);
    this.name = this.constructor.name;
  }
}

export class ApiUserRejectsError extends ApiBaseError {
  constructor(message: string = 'Canceled by the user') {
    super(message);
  }
}
