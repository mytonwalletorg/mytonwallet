import React, { memo, useLayoutEffect, useRef } from '../../lib/teact/teact';
import { setExtraStyles } from '../../lib/teact/teact-dom';

import type { ApiToken } from '../../api/types';

import buildClassName from '../../util/buildClassName';
import { stopEvent } from '../../util/domEvents';
import { REM } from '../../util/windowEnvironment';

import useSyncEffect from '../../hooks/useSyncEffect';

import Transition from '../ui/Transition';
import TokenIcon from './TokenIcon';

import styles from './SelectTokenButton.module.scss';

interface OwnProps {
  token?: ApiToken;
  noChainIcon?: boolean;
  className?: string;
  onClick: NoneToVoidFunction;
}

function SelectTokenButton({
  token, className, noChainIcon, onClick,
}: OwnProps) {
  const { transitionRef } = useSelectorWidth(token);
  const buttonTransitionKeyRef = useRef(0);
  const buttonStateStr = `${token?.symbol}_${token?.chain}`;

  useSyncEffect(() => {
    buttonTransitionKeyRef.current++;
  }, [buttonStateStr]);

  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    stopEvent(e);

    onClick();
  }

  function renderToken(tokenToRender?: ApiToken) {
    return (
      <Transition
        ref={transitionRef}
        name="fade"
        activeKey={buttonTransitionKeyRef.current}
        className={buildClassName(styles.wrapper, className)}
        slideClassName={styles.slide}
      >
        <button
          type="button"
          className={styles.button}
          onClick={handleClick}
        >
          {tokenToRender && (
            <TokenIcon
              token={tokenToRender}
              withChainIcon={!noChainIcon}
              size="middle"
              className={styles.tokenIcon}
            />
          )}
          <div className={styles.content}>
            <span>{tokenToRender?.symbol}</span>
            <i className={buildClassName('icon-chevron-right', styles.chevronIcon)} aria-hidden />
          </div>
        </button>
      </Transition>
    );
  }

  return renderToken(token);
}

export default memo(SelectTokenButton);

const BUTTON_WIDTH = 70 / REM;
const CHARACTER_WIDTH = 10;

function useSelectorWidth(token?: ApiToken) {
  const transitionRef = useRef<HTMLDivElement>();

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
