import React, {
  memo, useCallback, useEffect, useMemo, useState,
} from '../../lib/teact/teact';
import { withGlobal, getActions } from '../../global';

import { UserToken } from '../../global/types';

import { CARD_SECONDARY_VALUE_SYMBOL } from '../../config';
import { selectAllTokens } from '../../global/selectors';
import { formatCurrencyExtended } from '../../util/formatNumber';
import { throttle } from '../../util/schedulers';
import { bigStrToHuman } from '../../global/helpers';

import Button from '../ui/Button';
import Input from '../ui/Input';
import InputNumberRich from '../ui/InputNumberRich';

import styles from './Transfer.module.scss';
import modalStyles from '../ui/Modal.module.scss';

interface StateProps {
  initialAddress?: string;
  initialAmount?: number;
  initialComment?: string;
  fee?: string;
  tokens?: UserToken[];
  isLoading?: boolean;
}

const TON_ADDRESS_REGEX = /^[-\d\w_]{48}$/i;
const TON_RAW_ADDRESS_REGEX = /^0:[\da-h]{64}$/i;
const TON_DNS_REGEX = /^[-\da-z]{4,126}\.ton$/;
const COMMENT_MAX_SIZE_BYTES = 121; // Value derived empirically
const runThrottled = throttle((cb) => cb(), 1500, true);

function TransferInitial({
  initialAddress = '',
  initialAmount,
  initialComment = '',
  tokens,
  fee,
  isLoading,
}: StateProps) {
  const {
    submitTransferInitial,
    showNotification,
    fetchFee,
  } = getActions();

  const [shouldUseAllBalance, setShouldUseAllBalance] = useState<boolean>(false);
  const [shouldRenderPasteButton, setShouldRenderPasteButton] = useState<boolean>(true);
  const [toAddress, setToAddress] = useState<string>(initialAddress);
  const [amount, setAmount] = useState<number | undefined>(initialAmount);
  const [comment, setComment] = useState<string>(initialComment);
  const [hasToAddressError, setHasToAddressError] = useState<boolean>(false);
  const [hasAmountError, setHasAmountError] = useState<boolean>(false);
  const [isInsufficientBalance, setIsInsufficientBalance] = useState<boolean>(false);
  const balance = useMemo(() => (tokens ? getBalanceFromTokens(tokens) : undefined), [tokens]);
  const shouldRenderFee = fee && amount && amount > 0;
  const isAddressValid = toAddress && (
    TON_ADDRESS_REGEX.test(toAddress)
    || TON_DNS_REGEX.test(toAddress)
    || TON_RAW_ADDRESS_REGEX.test(toAddress)
  );

  useEffect(() => {
    if (shouldUseAllBalance && balance) {
      const calculatedFee = fee ? bigStrToHuman(fee) : 0;
      setAmount(balance - calculatedFee);
    }
  }, [balance, fee, shouldUseAllBalance]);

  useEffect(() => {
    if (!toAddress || hasToAddressError || !amount || !isAddressValid) {
      return;
    }

    runThrottled(() => {
      fetchFee({
        toAddress,
        amount,
        comment,
      });
    });
  }, [amount, comment, fetchFee, hasToAddressError, isAddressValid, toAddress]);

  const validateToAddress = useCallback(() => {
    setHasToAddressError(Boolean(toAddress) && !isAddressValid);
  }, [toAddress, isAddressValid]);

  const handlePasteClick = useCallback(() => {
    navigator.clipboard
      .readText()
      .then((clipboardText) => {
        if (clipboardText && (
          TON_ADDRESS_REGEX.test(clipboardText)
          || TON_DNS_REGEX.test(clipboardText)
          || TON_RAW_ADDRESS_REGEX.test(clipboardText)
        )) {
          setToAddress(clipboardText);
          validateToAddress();
        }
      })
      .catch(() => {
        showNotification({
          message: 'Error reading clipboard',
        });
        setShouldRenderPasteButton(false);
      });
  }, [showNotification, validateToAddress]);

  const handleAmountInput = useCallback((value?: number) => {
    setHasAmountError(false);
    setIsInsufficientBalance(false);

    if (value === undefined) {
      setAmount(undefined);
      return;
    }

    if (Number.isNaN(value) || value < 0) {
      setHasAmountError(true);
      return;
    }

    if (!balance || value > balance) {
      setHasAmountError(true);
      setIsInsufficientBalance(true);
      return;
    }

    setAmount(value);
  }, [balance]);

  const handleMaxAmountClick = useCallback((e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();

    if (!balance) {
      return;
    }

    setShouldUseAllBalance(true);
  }, [balance]);

  const handleAmountChange = useCallback(() => {
    setShouldUseAllBalance(false);
  }, []);

  const handleCommentChange = useCallback((value) => {
    setComment(trimStringByMaxBytes(value, COMMENT_MAX_SIZE_BYTES));
  }, []);

  const canSubmit = toAddress.length && amount && amount > 0 && !hasToAddressError && !hasAmountError;

  const handleSubmit = useCallback((e) => {
    e.preventDefault();

    if (!canSubmit) {
      return;
    }

    submitTransferInitial({
      amount: amount!,
      toAddress,
      comment,
    });
  }, [canSubmit, submitTransferInitial, amount, toAddress, comment]);

  function renderFee() {
    return (
      <div className={styles.fee}>
        <div>Fee</div>
        <div className={styles.feeValue}>
          {formatCurrencyExtended(bigStrToHuman(fee!), CARD_SECONDARY_VALUE_SYMBOL)}
        </div>
      </div>
    );
  }

  return (
    <form className={modalStyles.transitionContent} onSubmit={handleSubmit}>
      <Input
        isRequired
        labelText="Recipient address"
        placeholder="Wallet address or domain"
        value={toAddress}
        error={hasToAddressError ? 'Incorrect address' : undefined}
        onInput={setToAddress}
        onBlur={validateToAddress}
      >
        {shouldRenderPasteButton && toAddress === '' && (
          <Button isSimple className={styles.pasteButton} onClick={handlePasteClick} ariaLabel="Paste">
            <i className="icon-paste" />
          </Button>
        )}
      </Input>

      <InputNumberRich
        key="amount"
        id="amount"
        hasError={hasAmountError}
        error={isInsufficientBalance ? 'Insufficient balance' : undefined}
        value={amount}
        labelText="Amount"
        onChange={handleAmountChange}
        onInput={handleAmountInput}
        onPressEnter={handleSubmit}
      >
        {shouldRenderFee && renderFee()}
      </InputNumberRich>
      <div className={styles.note}>
        Your balance:{' '}
        <a href="#" onClick={handleMaxAmountClick} className={styles.balanceLink}>
          {balance !== undefined
            ? formatCurrencyExtended(balance, CARD_SECONDARY_VALUE_SYMBOL, true)
            : 'Loading...'}
        </a>
      </div>

      <Input
        labelText="Comment"
        placeholder="Optional"
        value={comment}
        onInput={handleCommentChange}
        isControlled
      />

      <div className={modalStyles.buttons}>
        <Button
          isPrimary
          isSubmit
          isDisabled={!canSubmit}
          isLoading={isLoading}
        >
          Send TON
        </Button>
      </div>
    </form>
  );
}

export default memo(withGlobal((global): StateProps => {
  const {
    toAddress: initialAddress,
    amount: initialAmount,
    comment: initialComment,
    fee,
  } = global.currentTransfer;

  return {
    initialAddress,
    initialAmount,
    initialComment,
    fee,
    tokens: selectAllTokens(global),
    isLoading: global.currentTransfer.isLoading,
  };
})(TransferInitial));

function getBalanceFromTokens(tokens: UserToken[]) {
  const primaryValue = tokens.reduce((acc, token) => acc + token.amount * token.price, 0);
  const secondaryFactor = tokens.find((token) => token.symbol === CARD_SECONDARY_VALUE_SYMBOL)!.price;

  return primaryValue / secondaryFactor;
}

function trimStringByMaxBytes(str: string, maxBytes: number) {
  const decoder = new TextDecoder('utf-8');
  const encoded = new TextEncoder().encode(str);

  return decoder.decode(encoded.slice(0, maxBytes));
}
