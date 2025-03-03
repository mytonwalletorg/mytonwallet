export class AssertionError extends Error {
  constructor(
    message: string,
    // Any additional information for the error to help debug it. Don't put sensitive information here.
    public metadata?: unknown,
  ) {
    super(message);
  }
}

export function assert(condition: boolean, message: string, metadata?: unknown) {
  if (!condition) {
    throw new AssertionError(message, metadata);
  }
}
