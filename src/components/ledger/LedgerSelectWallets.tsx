import React, {
  memo, useCallback, useMemo, useState,
} from '../../lib/teact/teact';

import type { Account } from '../../global/types';
import type { LedgerWalletInfo } from '../../util/ledger/types';

import { getActions } from '../../global';
import { bigStrToHuman } from '../../global/helpers';
import buildClassName from '../../util/buildClassName';
import { formatCurrency } from '../../util/formatNumber';
import { shortenAddress } from '../../util/shortenAddress';

import useLang from '../../hooks/useLang';

import Button from '../ui/Button';
import ModalHeader from '../ui/ModalHeader';

import styles from './LedgerModal.module.scss';

type OwnProps = {
  hardwareWallets?: LedgerWalletInfo[];
  accounts?: Record<string, Account>;
  onClose: () => void;
};

const ACCOUNT_ADDRESS_SHIFT = 6;
const ACCOUNT_ADDRESS_SHIFT_END = 6;
const ACCOUNT_BALANCE_DECIMALS = 3;

function LedgerSelectWallets({
  onClose,
  hardwareWallets,
  accounts,
}: OwnProps) {
  const {
    afterSelectHardwareWallets,
  } = getActions();
  const lang = useLang();

  const [selectedAccountIndices, setSelectedAccountIndices] = useState<number[]>([]);

  const handleAccountToggle = useCallback((index: number) => {
    if (selectedAccountIndices.includes(index)) {
      setSelectedAccountIndices(selectedAccountIndices.filter((id) => id !== index));
    } else {
      setSelectedAccountIndices(selectedAccountIndices.concat([index]));
    }
  }, [selectedAccountIndices]);

  const handleAddLedgerWallets = useCallback(() => {
    afterSelectHardwareWallets({ hardwareSelectedIndices: selectedAccountIndices });
    onClose();
  }, [afterSelectHardwareWallets, selectedAccountIndices, onClose]);

  const alreadyConnectedList = useMemo(
    () => Object.values(accounts ?? []).map(({ address }) => address),
    [accounts],
  );

  function renderAccount(address: string, balance: string, index: number, isConnected: boolean) {
    const isActive = isConnected || selectedAccountIndices.includes(index);

    return (
      <div
        key={address}
        className={buildClassName(styles.account, isActive && styles.account_current)}
        aria-label={lang('Switch Account')}
        onClick={isConnected ? undefined : () => handleAccountToggle(index)}
      >
        <span className={styles.accountName}>
          <i className={buildClassName(styles.accountCurrencyIcon, 'icon-ton')} aria-hidden />
          {formatCurrency(bigStrToHuman(balance), '', ACCOUNT_BALANCE_DECIMALS)}
        </span>
        <div className={styles.accountFooter}>
          <span className={styles.accountAddress}>
            {shortenAddress(address, ACCOUNT_ADDRESS_SHIFT, ACCOUNT_ADDRESS_SHIFT_END)}
          </span>
        </div>

        <div className={buildClassName(styles.accountCheckMark, isActive && styles.accountCheckMark_active)} />
      </div>
    );
  }

  function renderAccounts() {
    const list = hardwareWallets ?? [];

    return (
      <div className={styles.accounts}>
        {list.map(
          ({ address, balance, index }) => renderAccount(
            address,
            balance,
            index,
            alreadyConnectedList.includes(address),
          ),
        )}
      </div>
    );
  }

  const areAccountsSelected = !selectedAccountIndices.length;
  const title = selectedAccountIndices.length
    ? lang('%1$d Selected', selectedAccountIndices.length) as string
    : lang('Select Ledger Wallets');

  return (
    <>
      <ModalHeader title={title} onClose={onClose} />
      <div className={styles.container}>
        {renderAccounts()}
        <div className={styles.actionBlock}>
          <Button onClick={onClose} className={styles.button}>{lang('Cancel')}</Button>
          <Button
            isPrimary
            isDisabled={areAccountsSelected}
            onClick={handleAddLedgerWallets}
            className={styles.button}
          >
            {lang('Add')}
          </Button>
        </div>
      </div>
    </>
  );
}

export default memo(LedgerSelectWallets);
