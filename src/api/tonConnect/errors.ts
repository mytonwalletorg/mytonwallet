// eslint-disable-next-line max-classes-per-file
import type { ApiAnyDisplayError } from '../types';
import type { AllErrorCodes } from './types';
import { CONNECT_EVENT_ERROR_CODES } from './types';

import { ApiBaseError } from '../errors';

export class TonConnectError extends ApiBaseError {
  code: number;

  constructor(message: string, code: AllErrorCodes = 0, displayError?: ApiAnyDisplayError) {
    super(message);
    this.code = code;
    this.displayError = displayError;
  }
}

export class ManifestContentError extends TonConnectError {
  constructor(message = 'Manifest content error') {
    super(message, CONNECT_EVENT_ERROR_CODES.MANIFEST_CONTENT_ERROR);
  }
}

export class UnknownError extends TonConnectError {
  constructor(message = 'Unknown error.') {
    super(message, 0);
  }
}

export class BadRequestError extends TonConnectError {
  constructor(message = 'Bad request', displayError?: ApiAnyDisplayError) {
    super(message, 1, displayError);
  }
}

export class UnknownAppError extends TonConnectError {
  constructor(message = 'Unknown app error') {
    super(message, 100);
  }
}

export class UserRejectsError extends TonConnectError {
  constructor(message = 'The user rejected the action') {
    super(message, 300);
  }
}

export class InsufficientBalance extends BadRequestError {
  constructor(message = 'Insufficient balance') {
    super(message);
  }
}
