// eslint-disable-next-line max-classes-per-file
export class ApiBaseError extends Error {
  constructor(message: string) {
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
