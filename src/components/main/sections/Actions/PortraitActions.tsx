import type { ActionSheetButton } from '@capacitor/action-sheet';
import { ActionSheet, ActionSheetButtonStyle } from '@capacitor/action-sheet';
import { BottomSheet } from 'native-bottom-sheet';
import React, { memo } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import { DEFAULT_CEX_SWAP_SECOND_TOKEN_SLUG, TONCOIN_SLUG } from '../../../../config';
import buildClassName from '../../../../util/buildClassName';
import { vibrate } from '../../../../util/capacitor';
import { IS_DELEGATING_BOTTOM_SHEET, IS_IOS_APP } from '../../../../util/windowEnvironment';

import useFlag from '../../../../hooks/useFlag';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import AddBuyModal from '../../../addbuy/AddBuyModal';
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
}

function PortraitActions({
  hasStaking,
  isTestnet,
  isUnstakeRequested,
  onEarnClick,
  isLedger,
  isSwapDisabled,
  isOnRampDisabled,
}: OwnProps) {
  const {
    startTransfer, startSwap, openOnRampWidgetModal, openReceiveModal,
  } = getActions();

  const [isAddBuyModalOpened, openAddBuyModal, closeAddBuyModal] = useFlag();

  const lang = useLang();

  const isSwapAllowed = !isTestnet && !isLedger && !isSwapDisabled;
  const isOnRampAllowed = !isTestnet && !isOnRampDisabled;
  const isStakingAllowed = !isTestnet;

  const handleStartSwap = useLastCallback(() => {
    vibrate();

    startSwap();
  });

  const handleStartSwapWidget = () => {
    startSwap({
      tokenInSlug: DEFAULT_CEX_SWAP_SECOND_TOKEN_SLUG,
      tokenOutSlug: TONCOIN_SLUG,
      amountIn: '100',
    });
  };

  const handleStartTransfer = useLastCallback(() => {
    vibrate();

    startTransfer({ isPortrait: true });
  });

  const handleAddBuyClick = useLastCallback(async () => {
    vibrate();

    if (!IS_IOS_APP) {
      openAddBuyModal();
      return;
    }

    const options: ActionSheetButton[] = [
      ...(isOnRampAllowed ? [{ title: lang('Buy with Card') }] : []),
      ...(isSwapAllowed ? [{ title: lang('Buy with Crypto') }] : []),
      { title: lang('Receive with QR or Invoice') },
      {
        title: lang('Cancel'),
        style: ActionSheetButtonStyle.Cancel,
      },
    ];

    const actionByIndex = [
      ...(isOnRampAllowed ? [openOnRampWidgetModal] : []),
      ...(isSwapAllowed ? [handleStartSwapWidget] : []),
      openReceiveModal,
    ];

    if (IS_DELEGATING_BOTTOM_SHEET) {
      await BottomSheet.disable();
    }
    const result = await ActionSheet.showActions({ options });
    if (IS_DELEGATING_BOTTOM_SHEET) {
      await BottomSheet.enable();
    }

    actionByIndex[result.index]?.();
  });

  const handleEarnClick = useLastCallback(() => {
    vibrate();
    onEarnClick();
  });

  return (
    <div className={styles.container}>
      <div className={styles.buttons}>
        <Button className={styles.button} onClick={handleAddBuyClick} isSimple>
          <i className={buildClassName(styles.buttonIcon, 'icon-add-buy')} aria-hidden />
          {lang(isSwapAllowed || isOnRampAllowed ? 'Add / Buy' : 'Add')}
        </Button>
        <Button className={styles.button} onClick={handleStartTransfer} isSimple>
          <i className={buildClassName(styles.buttonIcon, 'icon-send')} aria-hidden />
          {lang('Send')}
        </Button>
        {isSwapAllowed && (
          <Button className={styles.button} onClick={handleStartSwap} isSimple>
            <i className={buildClassName(styles.buttonIcon, 'icon-swap')} aria-hidden />
            {lang('Swap')}
          </Button>
        )}
        {isStakingAllowed && (
          <Button
            className={buildClassName(styles.button, (hasStaking || isUnstakeRequested) && styles.button_purple)}
            onClick={handleEarnClick}
            isSimple
          >
            <i className={buildClassName(styles.buttonIcon, 'icon-earn')} aria-hidden />
            {lang(isUnstakeRequested ? 'Unstaking' : hasStaking ? 'Earning' : 'Earn')}
          </Button>
        )}
      </div>

      <AddBuyModal
        isOpen={isAddBuyModalOpened}
        isTestnet={isTestnet}
        isLedgerWallet={isLedger}
        isSwapDisabled={isSwapDisabled}
        isOnRampDisabled={isOnRampDisabled}
        onClose={closeAddBuyModal}
      />
    </div>
  );
}

export default memo(PortraitActions);
