import React, { memo, useCallback, useState } from '../../lib/teact/teact';
import { getActions } from '../../lib/teact/teactn';

import { AuthState } from '../../global/types';
import type { GlobalState } from '../../global/types';

import { withGlobal } from '../../global';
import { pick } from '../../util/iteratees';

import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';
import { useDeviceScreen } from '../../hooks/useDeviceScreen';

import SettingsAbout from '../settings/SettingsAbout';
import Transition from '../ui/Transition';
import AuthCreateBackup from './AuthCreateBackup';
import AuthCreatePassword from './AuthCreatePassword';
import AuthCreatingWallet from './AuthCreatingWallet';
import AuthImportMnemonic from './AuthImportMnemonic';
import AuthStart from './AuthStart';

import styles from './Auth.module.scss';

type StateProps = Pick<GlobalState['auth'], (
  'state' | 'mnemonic' | 'mnemonicCheckIndexes' | 'isLoading' | 'method'
)>;

const RENDER_COUNT = Object.keys(AuthState).length / 2;

const Auth = ({
  state,
  isLoading,
  mnemonic,
  mnemonicCheckIndexes,
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

  const [nextKey, setNextKey] = useState(renderingAuthState + 1);
  const updateNextKey = useCallback(() => {
    setNextKey(renderingAuthState + 1);
  }, [renderingAuthState]);

  // eslint-disable-next-line consistent-return
  function renderAuthScreen(isActive: boolean, isFrom: boolean, currentKey: number) {
    switch (currentKey) {
      case AuthState.none:
        return <AuthStart />;
      case AuthState.creatingWallet:
        return <AuthCreatingWallet isActive={isActive} />;
      case AuthState.createPassword:
        return <AuthCreatePassword isActive={isActive} isLoading={isLoading} method="createAccount" />;
      case AuthState.createBackup:
        return <AuthCreateBackup isActive={isActive} mnemonic={mnemonic} checkIndexes={mnemonicCheckIndexes} />;
      case AuthState.importWallet:
        return <AuthImportMnemonic isActive={isActive} />;
      case AuthState.importWalletCreatePassword:
        return <AuthCreatePassword isActive={isActive} isLoading={isLoading} method={method} />;
      case AuthState.about:
        return <SettingsAbout handleBackClick={closeAbout} />;
    }
  }

  return (
    <Transition
      name={isPortrait ? 'pushSlide' : 'semiFade'}
      activeKey={renderingAuthState}
      renderCount={RENDER_COUNT}
      shouldCleanup
      className={styles.transitionContainer}
      slideClassName={styles.transitionSlide}
      nextKey={nextKey}
      onStop={updateNextKey}
    >
      {renderAuthScreen}
    </Transition>
  );
};

export default memo(withGlobal((global): StateProps => {
  return pick(global.auth, [
    'state', 'mnemonic', 'mnemonicCheckIndexes', 'isLoading', 'method',
  ]);
})(Auth));
