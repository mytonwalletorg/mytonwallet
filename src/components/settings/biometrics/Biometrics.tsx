import React, { memo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import { BiometricsState } from '../../../global/types';

import BiometricsTurnOff from './TurnOff';
import BiometricsTurnOffWarning from './TurnOffWarning';
import BiometricsTurnOn from './TurnOn';

interface StateProps {
  state: BiometricsState;
  error?: string;
}

function Biometrics({ state, error }: StateProps) {
  const { closeBiometricSettings } = getActions();

  const isTurnOnBiometricsOpened = state === BiometricsState.TurnOnPasswordConfirmation
    || state === BiometricsState.TurnOnRegistration
    || state === BiometricsState.TurnOnVerification
    || state === BiometricsState.TurnOnComplete;
  const isTurnOffBiometricsOpened = state === BiometricsState.TurnOffBiometricConfirmation
    || state === BiometricsState.TurnOffCreatePassword
    || state === BiometricsState.TurnOffComplete;
  const isTurnOffBiometricsWarningOpened = state === BiometricsState.TurnOffWarning;

  return (
    <>
      <BiometricsTurnOn
        isOpen={isTurnOnBiometricsOpened}
        state={state}
        error={error}
        onClose={closeBiometricSettings}
      />
      <BiometricsTurnOff
        isOpen={isTurnOffBiometricsOpened}
        state={state}
        error={error}
        onClose={closeBiometricSettings}
      />
      <BiometricsTurnOffWarning isOpen={isTurnOffBiometricsWarningOpened} onClose={closeBiometricSettings} />
    </>
  );
}

export default memo(withGlobal((global) => {
  const { biometrics: { state, error } } = global;

  return {
    state,
    error,
  };
})(Biometrics));
