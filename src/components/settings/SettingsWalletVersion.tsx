import React, { memo } from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { ApiWalletVersion } from '../../api/types';

import buildClassName from '../../util/buildClassName';
import { shortenAddress } from '../../util/shortenAddress';

import useHistoryBack from '../../hooks/useHistoryBack';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useScrolledState from '../../hooks/useScrolledState';

import Button from '../ui/Button';
import ModalHeader from '../ui/ModalHeader';

import styles from './Settings.module.scss';

export interface Wallet {
  address: string;
  version: ApiWalletVersion;
  totalBalance: string;
  tokens: string[];
}

interface OwnProps {
  isActive?: boolean;
  handleBackClick: () => void;
  isInsideModal?: boolean;
  wallets?: Wallet[];
  currentVersion?: ApiWalletVersion;
}

function SettingsWalletVersion({
  isActive,
  handleBackClick,
  isInsideModal,
  currentVersion,
  wallets,
}: OwnProps) {
  const {
    closeSettings,
    importAccountByVersion,
  } = getActions();
  const lang = useLang();

  useHistoryBack({
    isActive,
    onBack: handleBackClick,
  });

  const {
    handleScroll: handleContentScroll,
    isScrolled,
  } = useScrolledState();

  const handleAddWallet = useLastCallback((version: ApiWalletVersion) => {
    closeSettings();
    importAccountByVersion({ version });
  });

  function renderWallets() {
    return wallets?.map((v) => {
      return (
        <div
          key={v.address}
          className={buildClassName(styles.item, styles.item_wallet_version)}
          onClick={() => handleAddWallet(v.version)}
        >
          <div className={styles.walletVersionInfo}>
            <span className={styles.walletVersionTitle}>{v.version}</span>
            <span className={styles.walletVersionAddress}>{shortenAddress(v.address)}</span>
          </div>
          <div className={styles.walletVersionInfoRight}>
            <span className={styles.walletVersionTokens}>
              {v.tokens.join(', ')}
            </span>
            <span className={styles.walletVersionAmount}>
              ≈&thinsp;{v.totalBalance}
            </span>
          </div>
          <i className={buildClassName(styles.iconChevronRight, 'icon-chevron-right')} aria-hidden />
        </div>
      );
    });
  }

  return (
    <div className={styles.slide}>
      {isInsideModal ? (
        <ModalHeader
          title={lang('Wallet Versions')}
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
          <span className={styles.headerTitle}>{lang('Wallet Versions')}</span>
        </div>
      )}
      <div
        className={buildClassName(styles.content, 'custom-scroll')}
        onScroll={handleContentScroll}
      >
        <div className={styles.blockWalletVersionText}>
          <span>{lang('$current_wallet_version', { version: <strong>{currentVersion}</strong> })}</span>
          <span>{lang('You have tokens on other versions of your wallet. You can import them from here.')}</span>
        </div>
        <div className={styles.block}>
          {renderWallets()}
        </div>
        <div className={styles.blockWalletVersionReadMore}>
          {lang('$read_more_about_wallet_version', {
            ton_link: (
              <a href="https://docs.ton.org/participate/wallets/contracts" target="_blank" rel="noreferrer">
                ton.org
              </a>
            ),
          })}
        </div>
      </div>
    </div>
  );
}

export default memo(SettingsWalletVersion);
