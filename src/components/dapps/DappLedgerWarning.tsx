import React, {
  memo,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiDapp } from '../../api/types';
import { type Account, TransferState } from '../../global/types';

import { TONCOIN } from '../../config';
import renderText from '../../global/helpers/renderText';
import { selectCurrentToncoinBalance, selectNetworkAccounts } from '../../global/selectors';
import { toDecimal } from '../../util/decimals';
import { formatCurrency } from '../../util/formatNumber';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import Button from '../ui/Button';
import DappInfo from './DappInfo';

import modalStyles from '../ui/Modal.module.scss';
import styles from './Dapp.module.scss';

interface StateProps {
  currentAccount?: Account;
  toncoinBalance: bigint;
  dapp?: ApiDapp;
}

function DappLedgerWarning({
  currentAccount,
  toncoinBalance,
  dapp,
}: StateProps) {
  const { cancelDappTransfer, setDappTransferScreen } = getActions();

  const lang = useLang();

  const handleAgree = useLastCallback(() => {
    setDappTransferScreen({ state: TransferState.Initial });
  });

  function renderDapp() {
    return (
      <div className={styles.transactionDirection}>
        <div className={styles.transactionAccount}>
          <div className={styles.accountTitle}>{currentAccount?.title}</div>
          <div className={styles.accountBalance}>{formatCurrency(toDecimal(toncoinBalance), TONCOIN.symbol)}</div>
        </div>

        <DappInfo
          dapp={dapp}
          className={styles.transactionDapp}
        />
      </div>
    );
  }

  return (
    <div className={modalStyles.transitionContent}>
      {renderDapp()}

      <div className={styles.descriptionContent}>
        <span>{renderText(lang('$dapp_ledger_warning1'))}</span>
        <span>{renderText(lang('$dapp_ledger_warning2'))}</span>
      </div>

      <div className={modalStyles.buttons}>
        <Button className={modalStyles.button} onClick={cancelDappTransfer}>{lang('Cancel')}</Button>
        <Button
          isPrimary
          isSubmit
          className={modalStyles.button}
          onClick={handleAgree}
        >
          {lang('Agree')}
        </Button>
      </div>
    </div>
  );
}

export default memo(withGlobal((global): StateProps => {
  const { dapp } = global.currentDappTransfer;
  const accounts = selectNetworkAccounts(global);

  return {
    currentAccount: accounts?.[global.currentAccountId!],
    toncoinBalance: selectCurrentToncoinBalance(global),
    dapp,
  };
})(DappLedgerWarning));
