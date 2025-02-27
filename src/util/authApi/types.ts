export type AuthConfig = AuthPassword | WebAuthn | ElectronSafeStorage | NativeBiometrics;

export interface AuthPassword {
  kind: 'password';
}

export interface WebAuthn {
  kind: 'webauthn';
  type: 'largeBlob' | 'credBlob' | 'userHandle';
  credentialId: string;
  transports?: AuthenticatorTransport[];
}

export interface ElectronSafeStorage {
  kind: 'electron-safe-storage';
  encryptedPassword: string;
}

export interface NativeBiometrics {
  kind: 'native-biometrics';
}

export interface BiometricsSetupResult {
  password: string;
  config: AuthConfig;
}
