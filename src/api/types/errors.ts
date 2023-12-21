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
  UnsupportedHardwarePayload = 'UnsupportedHardwarePayload',
  InvalidAddressFormat = 'InvalidAddressFormat',
}

export enum ApiTransactionError {
  PartialTransactionFailure = 'PartialTransactionFailure',
  IncorrectDeviceTime = 'IncorrectDeviceTime',
  InsufficientBalance = 'InsufficientBalance',
  UnsuccesfulTransfer = 'UnsuccesfulTransfer',
  UnsupportedHardwarePayload = 'UnsupportedHardwarePayload',
}

export type ApiAnyDisplayError = ApiCommonError | ApiTransactionDraftError | ApiTransactionError;
