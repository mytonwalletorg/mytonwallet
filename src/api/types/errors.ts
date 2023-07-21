export enum ApiTransactionDraftError {
  InvalidAmount = 'InvalidAmount',
  InvalidToAddress = 'InvalidToAddress',
  InsufficientBalance = 'InsufficientBalance',
  Unexpected = 'Unexpected',
  DomainNotResolved = 'DomainNotResolved',
  WalletNotInitialized = 'WalletNotInitialized',
  UnsupportedHardwarePayload = 'UnsupportedHardwarePayload',
}

export enum ApiTransactionError {
  PartialTransactionFailure = 'PartialTransactionFailure',
  IncorrectDeviceTime = 'IncorrectDeviceTime',
  InsufficientBalance = 'InsufficientBalance',
  UnsuccesfulTransfer = 'UnsuccesfulTransfer',
  UnsupportedHardwarePayload = 'UnsupportedHardwarePayload',
  Unexpected = 'Unexpected',
}

export type ApiAnyDisplayError = ApiTransactionDraftError | ApiTransactionError;
