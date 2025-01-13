import type { Wallet } from '@tonconnect/sdk';
import React, { memo } from '../../lib/teact/teact';

import Footer from './Footer';

interface OwnProps {
  children: React.ReactNode;
  onConnectClick?: (args?: any) => any;
  wallet?: Wallet;
  isGiveawayFinished: boolean;
}

function CommonPage({
  children, onConnectClick, wallet, isGiveawayFinished,
}: OwnProps) {
  return (
    <>
      {children}
      <Footer
        onConnectClick={onConnectClick}
        wallet={wallet}
        isGiveawayFinished={isGiveawayFinished}
      />
    </>
  );
}

export default memo(CommonPage);
