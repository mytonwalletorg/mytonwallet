import React, { memo, useCallback, useState } from '../../lib/teact/teact';
import { withGlobal } from '../../global';

import { AuthState, GlobalState } from '../../global/types';

import { pick } from '../../util/iteratees';
import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';

import Transition from '../ui/Transition';
import AuthStart from './AuthStart';
import AuthCreatingWallet from './AuthCreatingWallet';
import AuthCreatePassword from './AuthCreatePassword';
import AuthImportMnemonic from './AuthImportMnemonic';
import AuthCreateBackup from './AuthCreateBackup';

import styles from './Auth.module.scss';

type StateProps = Pick<GlobalState['auth'], (
  'state' | 'mnemonic' | 'mnemonicCheckIndexes' | 'isLoading'
)>;

const Auth = ({
  state,
  isLoading,
  mnemonic,
  mnemonicCheckIndexes,
}: StateProps) => {
  // Transitioning to ready state is done in another component
  const renderingAuthState = useCurrentOrPrev(
    state === AuthState.ready ? undefined : state,
    true,
  ) ?? -1;

  const [nextKey, setNextKey] = useState(renderingAuthState + 1);
  const updateNextKey = useCallback(() => {
    setNextKey((current) => current + 1);
  }, []);

  // eslint-disable-next-line consistent-return
  function renderAuthScreen(isActive: boolean, isFrom: boolean, currentKey: number) {
    switch (currentKey) {
      case AuthState.none:
        return <AuthStart />;
      case AuthState.creatingWallet:
        return <AuthCreatingWallet isActive={isActive} />;
      case AuthState.createPassword:
        return <AuthCreatePassword isActive={isActive} isLoading={isLoading} />;
      case AuthState.createBackup:
        return <AuthCreateBackup isActive={isActive} mnemonic={mnemonic} checkIndexes={mnemonicCheckIndexes} />;
      case AuthState.importWallet:
        return <AuthImportMnemonic isActive={isActive} />;
      case AuthState.importWalletCreatePassword:
        return <AuthCreatePassword isActive={isActive} isLoading={isLoading} isImporting />;
    }
  }

  return (
    <Transition
      name="push-slide"
      activeKey={renderingAuthState}
      nextKey={nextKey}
      shouldCleanup
      onStop={updateNextKey}
      className={styles.transitionContainer}
    >
      {renderAuthScreen}
    </Transition>
  );
};

export default memo(withGlobal((global): StateProps => {
  return pick(global.auth, [
    'state', 'mnemonic', 'mnemonicCheckIndexes', 'isLoading',
  ]);
})(Auth));
