import type { Wallet } from '@tonconnect/sdk';
import React, { memo } from '../../lib/teact/teact';

import { prettifyAddress } from '../utils/tonConnect';

import Button from '../../components/ui/Button';

import pageStyles from './CommonPage.module.scss';
import styles from './Footer.module.scss';

interface OwnProps {
  onConnectClick?: (args?: any) => any;
  wallet?: Wallet;
  isGiveawayFinished: boolean;
}

function Footer({ onConnectClick, wallet, isGiveawayFinished }: OwnProps) {
  return (
    <div className={styles.footer}>
      {wallet
        ? (
          <div className={styles.walletInfo}>
            <div className={styles.walletAddress}>
              {prettifyAddress(wallet.account.address)}
            </div>
            <div className={styles.walletDescription}>
              Connected Wallet
            </div>
          </div>
        )
        : !isGiveawayFinished && (
          <div className={pageStyles.container}>
            <Button
              isSimple
              className={styles.button}
              onClick={onConnectClick}
            >Connect MyTonWallet
            </Button>
          </div>
        )}
    </div>
  );
}

export default memo(Footer);
