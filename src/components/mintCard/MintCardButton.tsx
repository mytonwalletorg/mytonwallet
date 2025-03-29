import React, { memo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import { ANIMATED_STICKER_TINY_ICON_PX } from '../../config';
import { selectCurrentAccountState } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { ANIMATED_STICKERS_PATHS } from '../ui/helpers/animatedAssets';

import useLang from '../../hooks/useLang';
import useShowTransition from '../../hooks/useShowTransition';

import AnimatedIconWithPreview from '../ui/AnimatedIconWithPreview';

import styles from './MintCardButton.module.scss';

interface StateProps {
  isCardMinting?: boolean;
  hasCardsInfo?: boolean;
}

function MintCardButton({
  isCardMinting,
  hasCardsInfo,
}: StateProps) {
  const { openMintCardModal } = getActions();

  const lang = useLang();
  const {
    shouldRender: shouldRenderMintCardsButton,
    transitionClassNames: mintCardsButtonClassNames,
  } = useShowTransition(hasCardsInfo || isCardMinting);

  if (!shouldRenderMintCardsButton) return undefined;

  return (
    <button
      type="button"
      className={buildClassName(styles.button, mintCardsButtonClassNames)}
      aria-label={lang('Mint Cards')}
      title={lang('Mint Cards')}
      onClick={() => openMintCardModal()}
    >
      <i className={isCardMinting ? 'icon-magic-wand-loading' : 'icon-magic-wand'} aria-hidden />
      {isCardMinting && (
        <AnimatedIconWithPreview
          play
          size={ANIMATED_STICKER_TINY_ICON_PX}
          className={styles.icon}
          nonInteractive
          noLoop={false}
          tgsUrl={ANIMATED_STICKERS_PATHS.clockWhite}
          previewUrl={ANIMATED_STICKERS_PATHS.clockWhitePreview}
        />
      )}
    </button>
  );
}

export default memo(withGlobal((global): StateProps => {
  const accountState = selectCurrentAccountState(global);
  const { config } = selectCurrentAccountState(global) || {};

  return {
    hasCardsInfo: Boolean(config?.cardsInfo),
    isCardMinting: accountState?.isCardMinting,
  };
})(MintCardButton));
