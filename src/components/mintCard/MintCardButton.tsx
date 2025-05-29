import React, { memo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import { ANIMATION_LEVEL_MIN } from '../../config';
import { selectCurrentAccountState } from '../../global/selectors';

import useLang from '../../hooks/useLang';
import useShowTransition from '../../hooks/useShowTransition';

import ClockIcon from '../ui/ClockIcon';

import styles from './MintCardButton.module.scss';

interface StateProps {
  isCardMinting?: boolean;
  hasCardsInfo?: boolean;
  noAnimation?: boolean;
}

function MintCardButton({
  isCardMinting,
  hasCardsInfo,
  noAnimation,
}: StateProps) {
  const { openMintCardModal } = getActions();

  const lang = useLang();
  const {
    shouldRender: shouldRenderMintCardsButton,
    ref: mintCardsButtonRef,
  } = useShowTransition<HTMLButtonElement>({
    isOpen: hasCardsInfo || isCardMinting,
    withShouldRender: true,
  });

  if (!shouldRenderMintCardsButton) return undefined;

  return (
    <button
      ref={mintCardsButtonRef}
      type="button"
      className={styles.button}
      aria-label={lang('Mint Cards')}
      title={lang('Mint Cards')}
      onClick={() => openMintCardModal()}
    >
      <i className={isCardMinting ? 'icon-magic-wand-loading' : 'icon-magic-wand'} aria-hidden />
      {isCardMinting && <ClockIcon className={styles.icon} noAnimation={noAnimation} />}
    </button>
  );
}

export default memo(withGlobal((global): StateProps => {
  const accountState = selectCurrentAccountState(global);
  const { config } = selectCurrentAccountState(global) || {};
  const animationLevel = global.settings.animationLevel;

  return {
    hasCardsInfo: Boolean(config?.cardsInfo),
    isCardMinting: accountState?.isCardMinting,
    noAnimation: animationLevel === ANIMATION_LEVEL_MIN,
  };
})(MintCardButton));
