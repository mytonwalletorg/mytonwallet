export enum ApiCommonError {
  Unexpected = 'Unexpected',
  ServerError = 'ServerError',
  DebugError = 'DebugError',
  UnsupportedVersion = 'UnsupportedVersion',
}

export enum ApiAuthError {
  InvalidMnemonic = 'InvalidMnemonic',
  InvalidAddress = 'InvalidAddress',
  DomainNotResolved = 'DomainNotResolved',
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
  /** Used when the Ledger TON app needs to be updated to support this transaction */
  NotSupportedHardwareOperation = 'NotSupportedHardwareOperation',
  HardwareBlindSigningNotEnabled = 'HardwareBlindSigningNotEnabled',
  RejectedByUser = 'RejectedByUser',
  WrongAddress = 'WrongAddress',
  WrongNetwork = 'WrongNetwork',
}

export type ApiAnyDisplayError = ApiCommonError | ApiAuthError | ApiTransactionDraftError | ApiTransactionError;
