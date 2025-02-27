import { IS_CAPACITOR, IS_TELEGRAM_APP } from '../config';
import {
  getIsCapacitorBiometricAuthSupported,
  getIsCapacitorFaceIdAvailable,
  getIsCapacitorTouchIdAvailable,
} from './capacitor';
import {
  getIsTelegramBiometricAuthSupported,
  getIsTelegramFaceIdAvailable,
  getIsTelegramTouchIdAvailable,
} from './telegram';
import { getIsMobileTelegramApp, IS_BIOMETRIC_AUTH_SUPPORTED } from './windowEnvironment';

export function getIsBiometricAuthSupported() {
  return IS_BIOMETRIC_AUTH_SUPPORTED || getIsNativeBiometricAuthSupported();
}

export function getIsNativeBiometricAuthSupported() {
  return (IS_CAPACITOR && getIsCapacitorBiometricAuthSupported())
    || (IS_TELEGRAM_APP && getIsTelegramBiometricAuthSupported());
}

export function getIsFaceIdAvailable() {
  return (IS_CAPACITOR && getIsCapacitorFaceIdAvailable()) || (IS_TELEGRAM_APP && getIsTelegramFaceIdAvailable());
}

export function getIsTouchIdAvailable() {
  return (IS_CAPACITOR && getIsCapacitorTouchIdAvailable()) || (IS_TELEGRAM_APP && getIsTelegramTouchIdAvailable());
}

export function getDoesUsePinPad() {
  return IS_CAPACITOR || getIsMobileTelegramApp();
}
