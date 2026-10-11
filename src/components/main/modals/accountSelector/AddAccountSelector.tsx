import React, { memo } from '../../../../lib/teact/teact';

import buildClassName from '../../../../util/buildClassName';
import { toNativeDigits } from '../../../../util/nativeDigits';

import useLang from '../../../../hooks/useLang';

import ListItem from '../../../ui/ListItem';
import ModalHeader from '../../../ui/ModalHeader';
import WalletVersionSection from './WalletVersionSection';

import modalStyles from '../../../ui/Modal.module.scss';
import styles from './AccountSelectorModal.module.scss';

type OwnProps = {
  isNewAccountImporting?: boolean;
  isLoading?: boolean;
  hasOtherWalletVersions?: boolean;
  canAddSubwallet?: boolean;
  shouldHideBackButton?: boolean;
  onBack: NoneToVoidFunction;
  onNewAccountClick: NoneToVoidFunction;
  onNewSubwalletClick: NoneToVoidFunction;
  onImportAccountClick: NoneToVoidFunction;
  onViewModeWalletClick: NoneToVoidFunction;
  onOpenSettingWalletVersion: NoneToVoidFunction;
  onClose: NoneToVoidFunction;
};

function AddAccountSelector({
  isNewAccountImporting,
  isLoading,
  hasOtherWalletVersions,
  canAddSubwallet,
  shouldHideBackButton,
  onBack,
  onNewAccountClick,
  onNewSubwalletClick,
  onImportAccountClick,
  onViewModeWalletClick,
  onOpenSettingWalletVersion,
  onClose,
}: OwnProps) {
  const lang = useLang();

  return (
    <div className={modalStyles.transitionContentWrapper}>
      <ModalHeader
        title={lang('Add Wallet')}
        onBackButtonClick={shouldHideBackButton ? undefined : onBack}
        onClose={onClose}
      />

      <div className={buildClassName(styles.actionsSection, styles.actionsSectionShift)}>
        <ListItem
          icon="wallet-add"
          label={lang('New Wallet')}
          description={lang('From new secret words')}
          isLoading={!isNewAccountImporting && isLoading}
          onClick={onNewAccountClick}
        />
        {canAddSubwallet && (
          <ListItem
            icon="subwallet-add"
            label={lang('New Subwallet')}
            description={lang('From current secret words')}
            onClick={onNewSubwalletClick}
          />
        )}
      </div>

      <span className={styles.importText}>{lang('or import from')}</span>

      <div className={styles.actionsSection}>
        <ListItem
          icon="key"
          label={lang('$secret_words')}
          description={toNativeDigits(lang('Restore wallet from 12 or 24 words'))}
          onClick={onImportAccountClick}
          isLoading={isNewAccountImporting && isLoading}
        />
      </div>

      <div className={styles.actionsSection}>
        <ListItem
          icon="wallet-view"
          label={lang('View Any Address')}
          description={lang('Watch wallet in read-only mode')}
          onClick={onViewModeWalletClick}
        />
      </div>

      <WalletVersionSection
        isVisible={hasOtherWalletVersions}
        onClick={onOpenSettingWalletVersion}
      />
    </div>
  );
}

export default memo(AddAccountSelector);
