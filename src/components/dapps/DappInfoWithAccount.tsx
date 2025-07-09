import React, { memo } from '../../lib/teact/teact';
import { withGlobal } from '../../global';

import type { ApiDapp } from '../../api/types';
import type { Account } from '../../global/types';

import { TONCOIN } from '../../config';
import { selectCurrentToncoinBalance, selectNetworkAccounts } from '../../global/selectors';
import { toDecimal } from '../../util/decimals';
import { formatCurrency } from '../../util/formatNumber';

import DappInfo from './DappInfo';

import styles from './Dapp.module.scss';

interface OwnProps {
  dapp?: ApiDapp;
}

interface StateProps {
  toncoinBalance: bigint;
  currentAccountId: string;
  accounts?: Record<string, Account>;
}

function DappInfoWithAccount({
  dapp,
  toncoinBalance,
  currentAccountId,
  accounts,
}: OwnProps & StateProps) {
  return (
    <div className={styles.transactionDirection}>
      <div className={styles.transactionAccount}>
        <div className={styles.accountTitle}>{accounts?.[currentAccountId]?.title}</div>
        <div className={styles.accountBalance}>{formatCurrency(toDecimal(toncoinBalance), TONCOIN.symbol)}</div>
      </div>

      <DappInfo
        dapp={dapp}
        className={styles.transactionDapp}
      />
    </div>
  );
}

export default memo(withGlobal<OwnProps>((global): StateProps => {
  const accounts = selectNetworkAccounts(global);

  return {
    toncoinBalance: selectCurrentToncoinBalance(global),
    currentAccountId: global.currentAccountId!,
    accounts,
  };
})(DappInfoWithAccount));
