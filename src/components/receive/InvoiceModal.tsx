import TonWeb from 'tonweb';
import React, {
  memo, useCallback, useMemo, useState,
} from '../../lib/teact/teact';

import type { UserToken } from '../../global/types';

import { TON_TOKEN_SLUG } from '../../config';
import { withGlobal } from '../../global';
import { humanToBigStr } from '../../global/helpers';
import renderText from '../../global/helpers/renderText';
import { selectAccount, selectCurrentAccountTokens } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { ASSET_LOGO_PATHS } from '../ui/helpers/assetLogos';

import useLang from '../../hooks/useLang';

import Button from '../ui/Button';
import type { DropdownItem } from '../ui/DropDown';
import DropDown from '../ui/DropDown';
import Input from '../ui/Input';
import InteractiveTextField from '../ui/InteractiveTextField';
import Modal from '../ui/Modal';
import ModalTransitionContent from '../ui/ModalTransitionContent';
import RichNumberInput from '../ui/RichNumberInput';

import styles from './ReceiveModal.module.scss';

interface StateProps {
  address?: string;
  tokens?: UserToken[];
}

type OwnProps = {
  backButtonText?: string;
  isOpen: boolean;
  onBackButtonClick: () => void;
  onClose: () => void;
};

function InvoiceModal({
  address,
  backButtonText = 'Back',
  isOpen,
  tokens,
  onBackButtonClick,
  onClose,
}: StateProps & OwnProps) {
  const lang = useLang();

  const [amount, setAmount] = useState<number | undefined>(undefined);
  const [comment, setComment] = useState<string>('');
  const [hasAmountError, setHasAmountError] = useState<boolean>(false);

  const invoiceAmount = amount ? humanToBigStr(amount) : undefined;
  const invoiceUrl = address ? TonWeb.utils.formatTransferUrl(address, invoiceAmount, comment) : '';

  const dropdownItems = useMemo(() => {
    if (!tokens) {
      return [];
    }

    return tokens.reduce<DropdownItem[]>((acc, token) => {
      if (token.slug === TON_TOKEN_SLUG) {
        acc.push({
          value: token.slug,
          icon: token.image || ASSET_LOGO_PATHS[token.symbol.toLowerCase() as keyof typeof ASSET_LOGO_PATHS],
          name: token.symbol,
        });
      }

      return acc;
    }, []);
  }, [tokens]);

  const handleAmountInput = useCallback((value?: number) => {
    setHasAmountError(false);

    if (value === undefined) {
      setAmount(undefined);
      return;
    }

    if (Number.isNaN(value) || value < 0) {
      setHasAmountError(true);
      return;
    }

    setAmount(value);
  }, []);

  function renderTokens() {
    return <DropDown items={dropdownItems} selectedValue={TON_TOKEN_SLUG} className={styles.tokenDropdown} />;
  }

  return (
    <Modal isSlideUp hasCloseButton title={lang('Create Invoice')} isOpen={isOpen} onClose={onClose}>
      <ModalTransitionContent className={styles.contentInvoice}>
        <div className={buildClassName(styles.info, styles.info_push)}>
          {renderText(lang('$receive_invoice_description'))}
        </div>
        <RichNumberInput
          key="amount"
          id="amount"
          hasError={hasAmountError}
          value={amount}
          labelText={lang('Amount')}
          onChange={handleAmountInput}
        >
          {renderTokens()}
        </RichNumberInput>
        <Input
          value={comment}
          onInput={setComment}
          label={lang('Comment')}
          placeholder={lang('Optional')}
          wrapperClassName={styles.invoiceComment}
        />

        <p className={buildClassName(styles.description, styles.description_forInvoice)}>
          {lang('Share this URL to receive TON')}
        </p>
        <InteractiveTextField text={invoiceUrl} copyNotification={lang('Invoice link was copied!')} />

        <div className={styles.buttons}>
          <Button onClick={onBackButtonClick}>{backButtonText ?? lang('Back')}</Button>
        </div>
      </ModalTransitionContent>
    </Modal>
  );
}

export default memo(
  withGlobal<OwnProps>((global): StateProps => {
    const address = selectAccount(global, global.currentAccountId!)?.address;

    return {
      address,
      tokens: selectCurrentAccountTokens(global),
    };
  })(InvoiceModal),
);
