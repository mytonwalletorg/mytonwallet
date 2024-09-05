export enum ApiCommonError {
  Unexpected = 'Unexpected',
  ServerError = 'ServerError',
  DebugError = 'DebugError',
  UnsupportedVersion = 'UnsupportedVersion',
}

export enum ApiTransactionDraftError {
  InvalidAmount = 'InvalidAmount',
  InvalidToAddress = 'InvalidToAddress',
  InsufficientBalance = 'InsufficientBalance',
  InvalidStateInit = 'InvalidStateInit',
  StateInitWithoutBin = 'StateInitWithoutBin',
  DomainNotResolved = 'DomainNotResolved',
  WalletNotInitialized = 'WalletNotInitialized',
  InvalidAddressFormat = 'InvalidAddressFormat',
  InactiveContract = 'InactiveContract',
}

export enum ApiTransactionError {
  PartialTransactionFailure = 'PartialTransactionFailure',
  IncorrectDeviceTime = 'IncorrectDeviceTime',
  InsufficientBalance = 'InsufficientBalance',
  UnsuccesfulTransfer = 'UnsuccesfulTransfer',
  NotSupportedHardwareOperation = 'NotSupportedHardwareOperation',
  HardwareBlindSigningNotEnabled = 'HardwareBlindSigningNotEnabled',
  WrongAddress = 'WrongAddress',
  WrongNetwork = 'WrongNetwork',
}

export type ApiAnyDisplayError = ApiCommonError | ApiTransactionDraftError | ApiTransactionError;
