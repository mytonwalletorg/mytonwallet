import React, { memo, useState } from '../../lib/teact/teact';
import { getActions } from '../../lib/teact/teactn';
import { withGlobal } from '../../global';

import type { GlobalState } from '../../global/types';
import { AuthState } from '../../global/types';

import { pick } from '../../util/iteratees';
import { IS_ANDROID } from '../../util/windowEnvironment';

import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';
import { useDeviceScreen } from '../../hooks/useDeviceScreen';
import useLastCallback from '../../hooks/useLastCallback';

import SettingsAbout from '../settings/SettingsAbout';
import Transition from '../ui/Transition';
import AuthBackupWalletModal from './AuthBackupWalletModal';
import AuthCheckPassword from './AuthCheckPassword';
import AuthConfirmBiometrics from './AuthConfirmBiometrics';
import AuthConfirmPin from './AuthConfirmPin';
import AuthCreateBackup from './AuthCreateBackup';
import AuthCreateBiometrics from './AuthCreateBiometrics';
import AuthCreateNativeBiometrics from './AuthCreateNativeBiometrics';
import AuthCreatePassword from './AuthCreatePassword';
import AuthCreatePin from './AuthCreatePin';
import AuthCreatingWallet from './AuthCreatingWallet';
import AuthDisclaimer from './AuthDisclaimer';
import AuthImportMnemonic from './AuthImportMnemonic';
import AuthStart from './AuthStart';

import styles from './Auth.module.scss';

type StateProps = Pick<GlobalState['auth'], (
  'state' | 'biometricsStep' | 'error' | 'mnemonic' | 'mnemonicCheckIndexes' | 'isLoading' | 'method'
  | 'isBackupModalOpen'
)>;

const RENDER_COUNT = Object.keys(AuthState).length / 2;

const Auth = ({
  state,
  biometricsStep,
  error,
  isLoading,
  mnemonic,
  mnemonicCheckIndexes,
  isBackupModalOpen,
  method,
}: StateProps) => {
  const {
    closeAbout,
  } = getActions();

  const { isPortrait } = useDeviceScreen();

  // Transitioning to ready state is done in another component
  const renderingAuthState = useCurrentOrPrev(
    state === AuthState.ready ? undefined : state,
    true,
  ) ?? -1;

  const [prevKey, setPrevKey] = useState<number | undefined>(undefined);
  const [nextKey, setNextKey] = useState(renderingAuthState + 1);
  const updateRenderingKeys = useLastCallback(() => {
    setNextKey(renderingAuthState + 1);
    setPrevKey(renderingAuthState === AuthState.confirmPin ? AuthState.createPin : undefined);
  });

  // eslint-disable-next-line consistent-return
  function renderAuthScreen(isActive: boolean, isFrom: boolean, currentKey: number) {
    switch (currentKey) {
      case AuthState.none:
        return <AuthStart />;
      case AuthState.createWallet:
        return <AuthCreatingWallet isActive={isActive} />;
      case AuthState.checkPassword:
        return (
          <AuthCheckPassword
            isActive={isActive}
            isLoading={isLoading}
            method="createAccount"
            error={error}
          />
        );
      case AuthState.createPin:
        return <AuthCreatePin isActive={isActive} method="createAccount" />;
      case AuthState.confirmPin:
        return <AuthConfirmPin isActive={isActive} method="createAccount" />;
      case AuthState.createBiometrics:
        return <AuthCreateBiometrics isActive={isActive} method="createAccount" />;
      case AuthState.confirmBiometrics:
        return (
          <AuthConfirmBiometrics
            isActive={isActive}
            isLoading={isLoading}
            error={error}
            biometricsStep={biometricsStep}
          />
        );
      case AuthState.createNativeBiometrics:
        return (
          <AuthCreateNativeBiometrics isActive={isActive} isLoading={isLoading} />
        );
      case AuthState.createPassword:
        return <AuthCreatePassword isActive={isActive} isLoading={isLoading} method="createAccount" />;
      case AuthState.createBackup:
        return <AuthCreateBackup isActive={isActive} />;
      case AuthState.disclaimerAndBackup:
        return (
          <AuthDisclaimer key="create" isActive={isActive} />
        );
      case AuthState.importWallet:
        return <AuthImportMnemonic isActive={isActive} />;
      case AuthState.importWalletCreatePin:
        return <AuthCreatePin isActive={isActive} method="importMnemonic" />;
      case AuthState.importWalletConfirmPin:
        return <AuthConfirmPin isActive={isActive} method="importMnemonic" />;
      case AuthState.importWalletCheckPassword:
        return (
          <AuthCheckPassword
            isActive={isActive}
            isLoading={isLoading}
            method="importMnemonic"
            error={error}
          />
        );
      case AuthState.disclaimer:
        return (
          <AuthDisclaimer
            key="import"
            isActive={isActive}
            isImport
          />
        );
      case AuthState.importWalletCreateNativeBiometrics:
        return (
          <AuthCreateNativeBiometrics isActive={isActive} isLoading={isLoading} />
        );
      case AuthState.importWalletCreatePassword:
        return <AuthCreatePassword isActive={isActive} isLoading={isLoading} method={method} />;
      case AuthState.importWalletCreateBiometrics:
        return <AuthCreateBiometrics isActive={isActive} method={method} />;
      case AuthState.importWalletConfirmBiometrics:
        return (
          <AuthConfirmBiometrics
            isActive={isActive}
            isLoading={isLoading}
            error={error}
            biometricsStep={biometricsStep}
          />
        );
      case AuthState.about:
        return <SettingsAbout handleBackClick={closeAbout} />;
    }
  }

  return (
    <>
      <Transition
        name={isPortrait ? (IS_ANDROID ? 'slideFade' : 'slideLayers') : 'semiFade'}
        activeKey={renderingAuthState}
        renderCount={RENDER_COUNT}
        shouldCleanup
        className={styles.transitionContainer}
        slideClassName={styles.transitionSlide}
        prevKey={prevKey}
        nextKey={nextKey}
        onStop={updateRenderingKeys}
        shouldWrap
      >
        {renderAuthScreen}
      </Transition>
      <AuthBackupWalletModal
        isOpen={isBackupModalOpen}
        mnemonic={mnemonic}
        checkIndexes={mnemonicCheckIndexes}
      />
    </>
  );
};

export default memo(withGlobal((global): StateProps => {
  return pick(global.auth, [
    'state', 'biometricsStep', 'error', 'mnemonic', 'mnemonicCheckIndexes', 'isLoading', 'method',
    'isBackupModalOpen',
  ]);
})(Auth));
