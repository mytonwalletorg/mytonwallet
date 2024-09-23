import type { Wallet } from '@tonconnect/sdk';
import React, { memo } from '../../lib/teact/teact';

import Footer from './Footer';

interface OwnProps {
  children: React.ReactNode;
  onConnectClick?: (args?: any) => any;
  wallet?: Wallet;
}

function CommonPage({
  children, onConnectClick, wallet,
}: OwnProps) {
  return (
    <>
      {children}
      <Footer onConnectClick={onConnectClick} wallet={wallet} />
    </>
  );
}

export default memo(CommonPage);
