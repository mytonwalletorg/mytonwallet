import React, { memo, useEffect } from '../lib/teact/teact';
import { getActions, withGlobal } from '../global';

import { updateSizes } from '../util/windowSize';
import buildClassName from '../util/buildClassName';
import { selectHasSession } from '../global/selectors';
import useFlag from '../hooks/useFlag';
import useTimeout from '../hooks/useTimeout';
import useOnChange from '../hooks/useOnChange';

import Transition from './ui/Transition';
import Auth from './auth/Auth';
import Main from './main/Main';
import SettingsModal from './main/modals/SettingsModal';
import Dialogs from './Dialogs';
// import Test from './components/test/TestNoRedundancy';

import styles from './App.module.scss';

interface StateProps {
  isAuth: boolean;
  isSettingsModalOpen?: boolean;
  accountId?: string;
}

const PRERENDER_MAIN_DELAY = 1200;
let mainKey = 0;

function App({ isAuth, accountId, isSettingsModalOpen }: StateProps) {
  // return <Test />;
  const { closeSettingsModal } = getActions();

  const [canPrerenderMain, prerenderMain] = useFlag();

  useTimeout(prerenderMain, isAuth && !canPrerenderMain ? PRERENDER_MAIN_DELAY : undefined);

  useEffect(updateSizes, []);
  useEffect(() => {
    if (isAuth && isSettingsModalOpen) {
      closeSettingsModal();
    }
  }, [closeSettingsModal, isAuth, isSettingsModalOpen]);

  useOnChange(() => {
    if (accountId) {
      mainKey++;
    }
  }, [accountId]);

  return (
    <div className={styles.containerOuter}>
      <div className={styles.containerInner}>
        <Transition
          name="semi-fade"
          activeKey={isAuth ? 0 : mainKey}
          nextKey={isAuth && canPrerenderMain ? mainKey + 1 : undefined}
          shouldCleanup
          slideClassName={buildClassName(styles.appSlide, 'custom-scroll')}
        >
          {(isActive: boolean, isFrom: boolean, currentKey: number) => (
            currentKey === 0 ? <Auth /> : <Main key={currentKey} />
          )}
        </Transition>
      </div>

      <SettingsModal isOpen={isSettingsModalOpen} onClose={closeSettingsModal} />
      <Dialogs />
    </div>
  );
}

export default memo(withGlobal((global): StateProps => {
  return {
    isAuth: !selectHasSession(global),
    accountId: global.currentAccountId,
    isSettingsModalOpen: global.isSettingsModalOpen,
  };
})(App));
