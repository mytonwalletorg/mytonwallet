import type { Wallet } from '@tonconnect/sdk';
import type { TeactNode } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';

import Footer from './Footer';

import styles from './CommonPage.module.scss';

interface OwnProps {
  children: TeactNode;
  onConnectClick?: (args?: any) => any;
  wallet?: Wallet;
  isGiveawayFinished: boolean;
}

function CommonPage({
  children, onConnectClick, wallet, isGiveawayFinished,
}: OwnProps) {
  return (
    <>
      <div className={styles.container}>
        {children}
      </div>
      <Footer
        onConnectClick={onConnectClick}
        wallet={wallet}
        isGiveawayFinished={isGiveawayFinished}
      />
    </>
  );
}

export default memo(CommonPage);
