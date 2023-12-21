import React, {
  memo,
  useLayoutEffect,
  useRef,
} from '../../../lib/teact/teact';
import { setExtraStyles } from '../../../lib/teact/teact-dom';
import { getActions } from '../../../global';

import { SwapState, type UserSwapToken } from '../../../global/types';

import { TON_BLOCKCHAIN } from '../../../config';
import buildClassName from '../../../util/buildClassName';
import getBlockchainNetworkIcon from '../../../util/swap/getBlockchainNetworkIcon';
import { REM } from '../../../util/windowEnvironment';
import { ASSET_LOGO_PATHS } from '../../ui/helpers/assetLogos';

import useLastCallback from '../../../hooks/useLastCallback';
import useSyncEffect from '../../../hooks/useSyncEffect';

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
  const buttonStateStr = `${token?.symbol}_${token?.blockchain}`;

  useSyncEffect(() => {
    buttonTransitionKeyRef.current++;
  }, [buttonStateStr]);

  function renderToken(tokenToRender: UserSwapToken | undefined) {
    const image = ASSET_LOGO_PATHS[
      tokenToRender?.symbol.toLowerCase() as keyof typeof ASSET_LOGO_PATHS
    ] ?? tokenToRender?.image;
    const blockchain = tokenToRender?.blockchain ?? TON_BLOCKCHAIN;

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
          <div className={styles.tokenIconWrapper}>
            <img src={image} alt="" className={styles.tokenIcon} />
            <img
              src={getBlockchainNetworkIcon(blockchain)}
              className={styles.tokenBlockchainIcon}
              alt={blockchain}
            />
          </div>
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
