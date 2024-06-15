export enum ApiCommonError {
  Unexpected = 'Unexpected',
  ServerError = 'ServerError',
  DebugError = 'DebugError',
}

export enum ApiTransactionDraftError {
  InvalidAmount = 'InvalidAmount',
  InvalidToAddress = 'InvalidToAddress',
  InsufficientBalance = 'InsufficientBalance',
  DomainNotResolved = 'DomainNotResolved',
  WalletNotInitialized = 'WalletNotInitialized',
  UnsupportedHardwareOperation = 'UnsupportedHardwareOperation',
  UnsupportedHardwareContract = 'UnsupportedHardwareContract',
  EncryptedDataNotSupported = 'EncryptedDataNotSupported',
  NonAsciiCommentForHardwareOperation = 'NonAsciiCommentForHardwareOperation',
  TooLongCommentForHardwareOperation = 'TooLongCommentForHardwareOperation',
  UnsupportedHardwareNftOperation = 'UnsupportedHardwareNftOperation',
  InvalidAddressFormat = 'InvalidAddressFormat',
  InactiveContract = 'InactiveContract',
}

export enum ApiTransactionError {
  PartialTransactionFailure = 'PartialTransactionFailure',
  IncorrectDeviceTime = 'IncorrectDeviceTime',
  InsufficientBalance = 'InsufficientBalance',
  UnsuccesfulTransfer = 'UnsuccesfulTransfer',
  UnsupportedHardwareContract = 'UnsupportedHardwareContract',
  UnsupportedHardwarePayload = 'UnsupportedHardwarePayload',
  NonAsciiCommentForHardwareOperation = 'NonAsciiCommentForHardwareOperation',
  TooLongCommentForHardwareOperation = 'TooLongCommentForHardwareOperation',
  UnsupportedHardwareNftOperation = 'UnsupportedHardwareNftOperation',
  WrongAddress = 'WrongAddress',
  WrongNetwork = 'WrongNetwork',
}

export type ApiAnyDisplayError = ApiCommonError | ApiTransactionDraftError | ApiTransactionError;
