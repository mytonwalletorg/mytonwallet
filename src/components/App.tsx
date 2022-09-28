import React, { memo, useEffect, useState } from '../lib/teact/teact';
import { withGlobal } from '../global';

import { updateSizes } from '../util/windowSize';
import buildClassName from '../util/buildClassName';
import { selectHasSession } from '../global/selectors';
import useTimeout from '../hooks/useTimeout';

import Transition from './ui/Transition';
import Auth from './auth/Auth';
import Main from './main/Main';
import Dialogs from './main/Dialogs';
// import Test from './components/test/TestNoRedundancy';

import styles from './App.module.scss';

interface StateProps {
  isGuest: boolean;
}

const PRERENDER_MAIN_DELAY = 1200;

function App({ isGuest }: StateProps) {
  // return <Test />;

  const [mainPrerenderKey, setMainPrerenderKey] = useState<number | undefined>();
  useTimeout(() => {
    setMainPrerenderKey(Math.random());
  }, isGuest ? PRERENDER_MAIN_DELAY : undefined);

  useEffect(() => {
    updateSizes();
  }, []);

  return (
    <div className={styles.containerOuter}>
      <div className={styles.containerInner}>
        <Transition
          name="fade"
          activeKey={isGuest ? 0 : 1}
          nextKey={mainPrerenderKey ? 1 : undefined}
          shouldCleanup
          slideClassName={buildClassName(styles.appSlide, 'custom-scroll')}
        >
          {(isActive: boolean, isFrom: boolean, currentKey: number) => (
            currentKey === 0 ? <Auth /> : <Main key={mainPrerenderKey} />
          )}
        </Transition>
      </div>

      <Dialogs />
    </div>
  );
}

export default memo(withGlobal((global) => {
  return {
    isGuest: !selectHasSession(global),
  };
})(App));
