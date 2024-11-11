import type { Wallet } from '@tonconnect/sdk';
import React, { memo } from '../../lib/teact/teact';

import { prettifyAddress } from '../utils/tonConnect';

import Button from '../../components/ui/Button';

import styles from './Footer.module.scss';

interface OwnProps {
  onConnectClick?: (args?: any) => any;
  wallet?: Wallet;
}

function Footer({ onConnectClick, wallet }: OwnProps) {
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
        : (
          <Button
            isSimple
            className={styles.button}
            onClick={onConnectClick!}
          >Connect Wallet
          </Button>
        )}
    </div>
  );
}

export default memo(Footer);
