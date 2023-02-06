// eslint-disable-next-line max-classes-per-file
import { AllErrorCodes, CONNECT_EVENT_ERROR_CODES } from './types';

export class TonConnectError extends Error {
  code: number;

  constructor(message: string, code: AllErrorCodes = 0) {
    super(message);
    Error.captureStackTrace(this);
    this.name = 'TonConnectError';
    this.code = code;
  }
}

export class ManifestContentError extends TonConnectError {
  constructor(message = 'Manifest content error') {
    super(message, CONNECT_EVENT_ERROR_CODES.MANIFEST_CONTENT_ERROR);
  }
}

export class UnknownError extends TonConnectError {
  constructor(message = 'Unknown error') {
    super(message, 0);
  }
}

export class BadRequestError extends TonConnectError {
  constructor(message = 'Bad request') {
    super(message, 1);
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
