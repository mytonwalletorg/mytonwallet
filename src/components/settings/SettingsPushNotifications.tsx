import React, { memo, useMemo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { Account, AccountSettings, GlobalState } from '../../global/types';

import { MAX_PUSH_NOTIFICATIONS_ACCOUNT_COUNT } from '../../config';
import { selectNetworkAccounts } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';

import useHistoryBack from '../../hooks/useHistoryBack';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useScrolledState from '../../hooks/useScrolledState';

import AccountButton from '../common/AccountButton';
import AccountButtonWrapper from '../common/AccountButtonWrapper';
import Button from '../ui/Button';
import ModalHeader from '../ui/ModalHeader';
import Switcher from '../ui/Switcher';

import styles from './Settings.module.scss';

interface OwnProps {
  isActive?: boolean;
  handleBackClick: () => void;
  isInsideModal?: boolean;
}

interface StateProps {
  accounts?: Record<string, Account>;
  canPlaySounds?: boolean;
  settingsByAccountId?: Record<string, AccountSettings>;
  pushNotifications: GlobalState['pushNotifications'];
}

function SettingsPushNotifications({
  isActive,
  handleBackClick,
  accounts,
  canPlaySounds,
  pushNotifications: {
    enabledAccounts,
    isAvailable,
  },
  isInsideModal,
  settingsByAccountId,
}: OwnProps & StateProps) {
  const lang = useLang();

  const { toggleNotifications, toggleNotificationAccount, toggleCanPlaySounds } = getActions();
  const iterableAccounts = useMemo(() => Object.entries(accounts || {}), [accounts]);
  const arePushNotificationsEnabled = Boolean(Object.keys(enabledAccounts).length);

  const handlePushNotificationsToggle = useLastCallback(() => {
    toggleNotifications({ isEnabled: !arePushNotificationsEnabled });
  });

  const handleCanPlaySoundToggle = useLastCallback(() => {
    toggleCanPlaySounds({ isEnabled: !canPlaySounds });
  });

  useHistoryBack({
    isActive,
    onBack: handleBackClick,
  });

  const {
    handleScroll: handleContentScroll,
    isScrolled,
  } = useScrolledState();

  function renderAccount(accountId: string, address: string, title?: string, isHardware?: boolean) {
    const onClick = () => {
      toggleNotificationAccount({ accountId });
    };

    const { cardBackgroundNft } = settingsByAccountId?.[accountId] || {};

    const isDisabled = enabledAccounts
      && !enabledAccounts[accountId]
      && Object.keys(enabledAccounts).length >= MAX_PUSH_NOTIFICATIONS_ACCOUNT_COUNT;

    return (
      <AccountButton
        className={buildClassName(
          styles.account,
          isDisabled ? styles.accountDisabled : undefined,
        )}
        key={accountId}
        accountId={accountId}
        address={address}
        title={title}
        ariaLabel={lang('Switch Account')}
        isHardware={isHardware}
        withCheckbox
        isLoading={isDisabled}
        isActive={Boolean(enabledAccounts && enabledAccounts[accountId])}
        // eslint-disable-next-line react/jsx-no-bind
        onClick={onClick}
        cardBackgroundNft={cardBackgroundNft}
      />
    );
  }

  function renderAccounts() {
    return (
      <AccountButtonWrapper
        accountLength={iterableAccounts.length}
        className={styles.settingsBlock}
      >
        {iterableAccounts.map(
          ([accountId, { title, addressByChain, isHardware }]) => {
            return renderAccount(accountId, addressByChain.ton, title, isHardware);
          },
        )}
      </AccountButtonWrapper>
    );
  }

  return (
    <div className={styles.slide}>
      {isInsideModal ? (
        <ModalHeader
          title={lang('Notifications & Sounds')}
          withNotch={isScrolled}
          onBackButtonClick={handleBackClick}
          className={styles.modalHeader}
        />
      ) : (
        <div className={buildClassName(styles.header, 'with-notch-on-scroll', isScrolled && 'is-scrolled')}>
          <Button isSimple isText onClick={handleBackClick} className={styles.headerBack}>
            <i className={buildClassName(styles.iconChevron, 'icon-chevron-left')} aria-hidden />
            <span>{lang('Back')}</span>
          </Button>
          <span className={styles.headerTitle}>{lang('Notifications & Sounds')}</span>
        </div>
      )}
      <div
        className={buildClassName(styles.content, 'custom-scroll')}
        onScroll={handleContentScroll}
      >
        {isAvailable && (
          <>
            <div className={styles.settingsBlock}>
              <div className={buildClassName(styles.item, styles.item_small)} onClick={handlePushNotificationsToggle}>
                {lang('Push Notifications')}

                <Switcher
                  className={styles.menuSwitcher}
                  label={lang('Push Notifications')}
                  checked={arePushNotificationsEnabled}
                />
              </div>
            </div>
            <p className={styles.blockTitle}>{
              lang(
                'Select up to %count% wallets for notifications',
                { count: MAX_PUSH_NOTIFICATIONS_ACCOUNT_COUNT },
              )
            }
            </p>
            {renderAccounts()}
          </>
        )}
        <div className={styles.settingsBlock}>
          <div className={buildClassName(styles.item, styles.item_small)} onClick={handleCanPlaySoundToggle}>
            {lang('Play Sounds')}

            <Switcher
              className={styles.menuSwitcher}
              label={lang('Play Sounds')}
              checked={canPlaySounds}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(withGlobal<OwnProps>((global): StateProps => {
  const accounts = selectNetworkAccounts(global);
  return {
    accounts,
    canPlaySounds: global.settings.canPlaySounds,
    pushNotifications: global.pushNotifications,
    settingsByAccountId: global.settings.byAccountId,
  };
})(SettingsPushNotifications));
