import type { ActionSheetButton } from '@capacitor/action-sheet';
import { ActionSheet, ActionSheetButtonStyle } from '@capacitor/action-sheet';
import type { URLOpenListenerEvent } from '@capacitor/app';
import { App as CapacitorApp } from '@capacitor/app';
import { BottomSheet } from 'native-bottom-sheet';
import React, { memo, useEffect } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import { ElectronEvent } from '../../../../electron/types';

import { IS_CAPACITOR, TON_TOKEN_SLUG, USDT_TRON_TOKEN_SLUG } from '../../../../config';
import buildClassName from '../../../../util/buildClassName';
import { clearLaunchUrl, getLaunchUrl } from '../../../../util/capacitor';
import { processDeeplink } from '../../../../util/processDeeplink';
import { IS_DELEGATING_BOTTOM_SHEET } from '../../../../util/windowEnvironment';

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
  onReceiveClick: NoneToVoidFunction;
  isLedger?: boolean;
  isSwapDisabled?: boolean;
  isOnRampDisabled?: boolean;
}

function PortraitActions({
  hasStaking,
  isTestnet,
  isUnstakeRequested,
  onEarnClick,
  onReceiveClick,
  isLedger,
  isSwapDisabled,
  isOnRampDisabled,
}: OwnProps) {
  const { startTransfer, startSwap, openOnRampWidgetModal } = getActions();

  const [isAddBuyModalOpened, openAddBuyModal, closeAddBuyModal] = useFlag();

  const lang = useLang();

  const isSwapAllowed = !isTestnet && !isLedger && !isSwapDisabled;
  const isOnRampAllowed = !isTestnet && !isLedger && !isOnRampDisabled;
  const isStakingAllowed = !isTestnet;

  useEffect(() => {
    return window.electron?.on(ElectronEvent.DEEPLINK, ({ url }: { url: string }) => {
      processDeeplink(url);
    });
  }, [startTransfer]);

  useEffect(() => {
    const launchUrl = getLaunchUrl();
    if (launchUrl) {
      processDeeplink(launchUrl);
      clearLaunchUrl();
    }

    return CapacitorApp.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
      processDeeplink(event.url);
    }).remove;
  }, [startTransfer]);

  const handleStartSwap = useLastCallback(() => {
    startSwap({ isPortrait: true });
  });

  const handleStartSwapWidget = () => {
    startSwap({
      isPortrait: true,
      tokenInSlug: USDT_TRON_TOKEN_SLUG,
      tokenOutSlug: TON_TOKEN_SLUG,
      amountIn: '100',
    });
  };

  const handleStartTransfer = useLastCallback(() => {
    startTransfer({ isPortrait: true });
  });

  const handleAddBuyClick = useLastCallback(async () => {
    if (!IS_CAPACITOR) {
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
      onReceiveClick,
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

  return (
    <div className={styles.container}>
      <div className={styles.buttons}>
        <Button className={styles.button} onClick={handleAddBuyClick} isSimple>
          <i className={buildClassName(styles.buttonIcon, 'icon-add-buy')} aria-hidden />
          {lang('Add / Buy')}
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
            className={buildClassName(styles.button, hasStaking && styles.button_purple)}
            onClick={onEarnClick}
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
        onReceiveClick={onReceiveClick}
        onClose={closeAddBuyModal}
      />
    </div>
  );
}

export default memo(PortraitActions);
