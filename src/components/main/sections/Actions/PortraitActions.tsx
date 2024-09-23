import React, { memo } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type { Theme } from '../../../../global/types';

import buildClassName from '../../../../util/buildClassName';
import { vibrate } from '../../../../util/capacitor';
import { ANIMATED_STICKERS_PATHS } from '../../../ui/helpers/animatedAssets';

import useAppTheme from '../../../../hooks/useAppTheme';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import Button from '../../../ui/Button';

import styles from './PortraitActions.module.scss';

interface OwnProps {
  hasStaking?: boolean;
  isTestnet?: boolean;
  isUnstakeRequested?: boolean;
  onEarnClick: NoneToVoidFunction;
  isLedger?: boolean;
  isSwapDisabled?: boolean;
  isOnRampDisabled?: boolean;
  theme: Theme;
}

function PortraitActions({
  hasStaking,
  isTestnet,
  isUnstakeRequested,
  onEarnClick,
  isLedger,
  isSwapDisabled,
  isOnRampDisabled,
  theme,
}: OwnProps) {
  const {
    startTransfer, startSwap, openReceiveModal,
  } = getActions();

  const appTheme = useAppTheme(theme);
  const stickerPaths = ANIMATED_STICKERS_PATHS[appTheme];

  const lang = useLang();

  const isSwapAllowed = !isTestnet && !isLedger && !isSwapDisabled;
  const isOnRampAllowed = !isTestnet && !isOnRampDisabled;
  const isStakingAllowed = !isTestnet;

  const handleStartSwap = useLastCallback(() => {
    void vibrate();

    startSwap();
  });

  const handleStartTransfer = useLastCallback(() => {
    void vibrate();

    startTransfer({ isPortrait: true });
  });

  const handleAddBuyClick = useLastCallback(() => {
    void vibrate();

    openReceiveModal();
  });

  const handleEarnClick = useLastCallback(() => {
    void vibrate();

    onEarnClick();
  });

  return (
    <div className={styles.container}>
      <div className={styles.buttons}>
        <Button
          isSimple
          className={styles.button}
          onClick={handleAddBuyClick}
        >
          <img src={stickerPaths.preview.iconAdd} alt="" className={styles.buttonIcon} />
          {lang(isSwapAllowed || isOnRampAllowed ? 'Add / Buy' : 'Add')}
        </Button>
        <Button
          isSimple
          className={styles.button}
          onClick={handleStartTransfer}
        >
          <img src={stickerPaths.preview.iconSend} alt="" className={styles.buttonIcon} />
          {lang('Send')}
        </Button>
        {isSwapAllowed && (
          <Button
            isSimple
            className={styles.button}
            onClick={handleStartSwap}
          >
            <img src={stickerPaths.preview.iconSwap} alt="" className={styles.buttonIcon} />
            {lang('Swap')}
          </Button>
        )}
        {isStakingAllowed && (
          <Button
            isSimple
            className={buildClassName(styles.button, (hasStaking || isUnstakeRequested) && styles.button_purple)}
            onClick={handleEarnClick}
          >
            <img src={stickerPaths.preview.iconEarn} alt="" className={styles.buttonIcon} />
            {lang(isUnstakeRequested ? 'Unstaking' : hasStaking ? 'Earning' : 'Earn')}
          </Button>
        )}
      </div>
    </div>
  );
}

export default memo(PortraitActions);
