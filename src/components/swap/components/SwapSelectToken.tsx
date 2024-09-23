import React, {
  memo,
  useLayoutEffect,
  useRef,
} from '../../../lib/teact/teact';
import { setExtraStyles } from '../../../lib/teact/teact-dom';
import { getActions } from '../../../global';

import { SwapState, type UserSwapToken } from '../../../global/types';

import buildClassName from '../../../util/buildClassName';
import { REM } from '../../../util/windowEnvironment';

import useLastCallback from '../../../hooks/useLastCallback';
import useSyncEffect from '../../../hooks/useSyncEffect';

import TokenIcon from '../../common/TokenIcon';
import Transition from '../../ui/Transition';

import styles from '../Swap.module.scss';

interface OwnProps {
  token?: UserSwapToken;
  shouldFilter?: boolean;
}

function SwapSelectToken({ token, shouldFilter }: OwnProps) {
  const { setSwapScreen } = getActions();

  const { transitionRef } = useSelectorWidth(token);

  const handleOpenSelectTokenModal = useLastCallback(() => {
    setSwapScreen({
      state: shouldFilter ? SwapState.SelectTokenTo : SwapState.SelectTokenFrom,
    });
  });

  const buttonTransitionKeyRef = useRef(0);
  const buttonStateStr = `${token?.symbol}_${token?.chain}`;

  useSyncEffect(() => {
    buttonTransitionKeyRef.current++;
  }, [buttonStateStr]);

  function renderToken(tokenToRender: UserSwapToken | undefined) {
    return (
      <Transition
        ref={transitionRef}
        name="fade"
        activeKey={buttonTransitionKeyRef.current}
        className={styles.tokenSelectorWrapper}
        slideClassName={styles.tokenSelectorSlide}
      >
        <button
          type="button"
          className={styles.tokenSelector}
          onClick={handleOpenSelectTokenModal}
        >
          {tokenToRender && (
            <TokenIcon
              token={tokenToRender}
              withChainIcon
              size="middle"
              className={styles.tokenIcon}
            />
          )}
          <div className={styles.tokenContent}>
            <span>{tokenToRender?.symbol}</span>
            <i className={buildClassName('icon-chevron-right', styles.tokenSelectorIcon)} aria-hidden />
          </div>
        </button>
      </Transition>
    );
  }

  return renderToken(token);
}

export default memo(SwapSelectToken);

const BUTTON_WIDTH = 70 / REM;
const CHARACTER_WIDTH = 10;

function useSelectorWidth(token?: UserSwapToken) {
  // eslint-disable-next-line no-null/no-null
  const transitionRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!transitionRef.current || !token) return;

    const symbolWidth = (token.symbol.length * CHARACTER_WIDTH) / REM;
    const minWidth = `${symbolWidth + BUTTON_WIDTH}rem`;

    setExtraStyles(transitionRef.current, {
      minWidth,
    });
  }, [token]);

  return {
    transitionRef,
  };
}
