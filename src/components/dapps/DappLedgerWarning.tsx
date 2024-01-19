import React, {
  memo,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiDapp } from '../../api/types';
import { type Account, TransferState, type UserToken } from '../../global/types';

import renderText from '../../global/helpers/renderText';
import { selectNetworkAccounts } from '../../global/selectors';
import { toDecimal } from '../../util/decimals';
import { formatCurrency } from '../../util/formatNumber';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import Button from '../ui/Button';
import DappInfo from './DappInfo';

import modalStyles from '../ui/Modal.module.scss';
import styles from './Dapp.module.scss';

interface OwnProps {
  tonToken: UserToken;
}

interface StateProps {
  currentAccount?: Account;
  dapp?: ApiDapp;
}

function DappLedgerWarning({
  tonToken,
  currentAccount,
  dapp,
}: OwnProps & StateProps) {
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
          <div className={styles.accountBalance}>{formatCurrency(toDecimal(tonToken.amount), tonToken.symbol)}</div>
        </div>

        <DappInfo
          iconUrl={dapp?.iconUrl}
          name={dapp?.name}
          url={dapp?.url}
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

export default memo(withGlobal<OwnProps>((global): StateProps => {
  const { dapp } = global.currentDappTransfer;
  const accounts = selectNetworkAccounts(global);

  return {
    currentAccount: accounts?.[global.currentAccountId!],
    dapp,
  };
})(DappLedgerWarning));
