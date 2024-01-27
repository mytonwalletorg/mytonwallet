export enum ApiCommonError {
  Unexpected = 'Unexpected',
  ServerError = 'ServerError',
}

export enum ApiTransactionDraftError {
  InvalidAmount = 'InvalidAmount',
  InvalidToAddress = 'InvalidToAddress',
  InsufficientBalance = 'InsufficientBalance',
  DomainNotResolved = 'DomainNotResolved',
  WalletNotInitialized = 'WalletNotInitialized',
  UnsupportedHardwareOperation = 'UnsupportedHardwareOperation',
  InvalidAddressFormat = 'InvalidAddressFormat',
}

export enum ApiTransactionError {
  PartialTransactionFailure = 'PartialTransactionFailure',
  IncorrectDeviceTime = 'IncorrectDeviceTime',
  InsufficientBalance = 'InsufficientBalance',
  UnsuccesfulTransfer = 'UnsuccesfulTransfer',
  UnsupportedHardwareOperation = 'UnsupportedHardwareOperation',
}

export type ApiAnyDisplayError = ApiCommonError | ApiTransactionDraftError | ApiTransactionError;
