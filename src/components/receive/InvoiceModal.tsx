import React, { memo, useMemo, useState } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { UserToken } from '../../global/types';
import type { DropdownItem } from '../ui/Dropdown';

import { TONCOIN } from '../../config';
import renderText from '../../global/helpers/renderText';
import { selectAccount, selectCurrentAccountTokens } from '../../global/selectors';
import { fromDecimal, toDecimal } from '../../util/decimals';
import formatTransferUrl from '../../util/ton/formatTransferUrl';
import { ASSET_LOGO_PATHS } from '../ui/helpers/assetLogos';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import Dropdown from '../ui/Dropdown';
import Input from '../ui/Input';
import InteractiveTextField from '../ui/InteractiveTextField';
import Modal from '../ui/Modal';
import RichNumberInput from '../ui/RichNumberInput';

import styles from './ReceiveModal.module.scss';

interface StateProps {
  isOpen?: boolean;
  address?: string;
  tokens?: UserToken[];
}

function InvoiceModal({
  address,
  isOpen,
  tokens,
}: StateProps) {
  const { closeInvoiceModal } = getActions();

  const lang = useLang();

  const [amount, setAmount] = useState<bigint | undefined>(undefined);
  const [comment, setComment] = useState<string>('');
  const [hasAmountError, setHasAmountError] = useState<boolean>(false);

  const invoiceUrl = address ? formatTransferUrl(address, amount, comment) : '';
  const decimals = TONCOIN.decimals; // TODO Change it after token selection is supported

  const dropdownItems = useMemo(() => {
    if (!tokens) {
      return [];
    }

    return tokens.reduce<DropdownItem[]>((acc, token) => {
      if (token.slug === TONCOIN.slug) {
        acc.push({
          value: token.slug,
          icon: token.image || ASSET_LOGO_PATHS[token.symbol.toLowerCase() as keyof typeof ASSET_LOGO_PATHS],
          name: token.symbol,
        });
      }

      return acc;
    }, []);
  }, [tokens]);

  const handleAmountInput = useLastCallback((stringValue?: string) => {
    setHasAmountError(false);

    if (!stringValue) {
      setAmount(undefined);
      return;
    }

    const value = fromDecimal(stringValue, decimals);

    if (value < 0) {
      setHasAmountError(true);
      return;
    }

    setAmount(value);
  });

  function renderTokens() {
    return <Dropdown items={dropdownItems} selectedValue={TONCOIN.slug} className={styles.tokenDropdown} />;
  }

  return (
    <Modal
      isOpen={isOpen}
      hasCloseButton
      title={lang('Deposit Link')}
      contentClassName={styles.content}
      nativeBottomSheetKey="invoice"
      onClose={closeInvoiceModal}
    >
      <div className={styles.contentTitle}>
        {renderText(lang('$receive_invoice_description'))}
      </div>
      <RichNumberInput
        key="amount"
        id="amount"
        hasError={hasAmountError}
        value={amount === undefined ? undefined : toDecimal(amount)}
        labelText={lang('Amount')}
        onChange={handleAmountInput}
      >
        {renderTokens()}
      </RichNumberInput>
      <Input
        value={comment}
        label={lang('Comment')}
        placeholder={lang('Optional')}
        wrapperClassName={styles.invoiceComment}
        onInput={setComment}
      />

      <p className={styles.labelForInvoice}>
        {lang('Share this URL to receive TON')}
      </p>
      <InteractiveTextField
        text={invoiceUrl}
        copyNotification={lang('Invoice link was copied!')}
        className={styles.invoiceLinkField}
      />
    </Modal>
  );
}

export default memo(
  withGlobal((global): StateProps => {
    const address = selectAccount(global, global.currentAccountId!)?.addressByChain?.ton;

    return {
      isOpen: global.isInvoiceModalOpen,
      address,
      tokens: selectCurrentAccountTokens(global),
    };
  })(InvoiceModal),
);
