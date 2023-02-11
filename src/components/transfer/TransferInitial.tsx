import React, {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from '../../lib/teact/teact';
import { withGlobal, getActions } from '../../global';

import type { UserToken } from '../../global/types';

import { CARD_SECONDARY_VALUE_SYMBOL, DEFAULT_PRICE_CURRENCY, TON_TOKEN_SLUG } from '../../config';
import { ASSET_LOGO_PATHS } from '../ui/helpers/assetLogos';
import { selectCurrentAccountTokens, selectCurrentAccountState } from '../../global/selectors';
import { shortenAddress } from '../../util/shortenAddress';
import { formatCurrency, formatCurrencyExtended } from '../../util/formatNumber';
import buildClassName from '../../util/buildClassName';
import { throttle } from '../../util/schedulers';
import { bigStrToHuman } from '../../global/helpers';
import dns from '../../util/dns';
import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import useShowTransition from '../../hooks/useShowTransition';
import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';

import Button from '../ui/Button';
import Input from '../ui/Input';
import RichNumberInput from '../ui/RichNumberInput';
import Menu from '../ui/Menu';
import DeleteSavedAddressModal from '../main/modals/DeleteSavedAddressModal';
import DropDown, { DropDownItem } from '../ui/DropDown';

import styles from './Transfer.module.scss';
import modalStyles from '../ui/Modal.module.scss';
import Transition from '../ui/Transition';

interface StateProps {
  initialAddress?: string;
  initialAmount?: number;
  initialComment?: string;
  fee?: string;
  tokenSlug?: string;
  tokens?: UserToken[];
  savedAddresses?: Record<string, string>;
  isLoading?: boolean;
}

const TON_ADDRESS_REGEX = /^[-\w_]{48}$/i;
const TON_RAW_ADDRESS_REGEX = /^0:[\da-h]{64}$/i;
const COMMENT_MAX_SIZE_BYTES = 121; // Value derived empirically
const SHORT_ADDRESS_SHIFT = 16;
const MIN_ADDRESS_LENGTH_TO_SHORTEN = SHORT_ADDRESS_SHIFT * 2;

// Fee may change, so we add 5% for more reliability. This is only safe for low-fee blockchains such as TON.
const RESERVED_FEE_FACTOR = 1.05;

const runThrottled = throttle((cb) => cb(), 1500, true);

function TransferInitial({
  tokenSlug = TON_TOKEN_SLUG,
  initialAddress = '',
  initialAmount,
  initialComment = '',
  tokens,
  fee,
  savedAddresses,
  isLoading,
}: StateProps) {
  const {
    submitTransferInitial,
    showNotification,
    fetchFee,
    changeTransferToken,
  } = getActions();

  // eslint-disable-next-line no-null/no-null
  const toAddressRef = useRef<HTMLInputElement>(null);

  const lang = useLang();

  const [shouldUseAllBalance, setShouldUseAllBalance] = useState<boolean>(false);
  const [shouldRenderPasteButton, setShouldRenderPasteButton] = useState<boolean>(true);
  const [isAddressFocused, markAddressFocused, unmarkAddressFocused] = useFlag();
  const [isSavedAddressesOpen, openSavedAddresses, closeSavedAddresses] = useFlag();
  const [savedAddressForDeletion, setSavedAddressForDeletion] = useState<string | undefined>();
  const [toAddress, setToAddress] = useState<string>(initialAddress);
  const [amount, setAmount] = useState<number | undefined>(initialAmount);
  const [comment, setComment] = useState<string>(initialComment);
  const [hasToAddressError, setHasToAddressError] = useState<boolean>(false);
  const [hasAmountError, setHasAmountError] = useState<boolean>(false);
  const [isInsufficientBalance, setIsInsufficientBalance] = useState<boolean>(false);

  const toAddressShort = toAddress.length > MIN_ADDRESS_LENGTH_TO_SHORTEN
    ? shortenAddress(toAddress, SHORT_ADDRESS_SHIFT) || ''
    : toAddress;
  const isAddressValid = getIsAddressValid(toAddress);
  const hasSavedAddresses = useMemo(() => {
    return savedAddresses && Object.keys(savedAddresses).length > 0;
  }, [savedAddresses]);
  const {
    amount: balance, decimals, price, symbol,
  } = useMemo(() => tokens?.find((token) => token.slug === tokenSlug), [tokenSlug, tokens]) || {};
  const amountInCurrency = price && amount && !Number.isNaN(amount) ? amount * price : undefined;
  const renderingAmountInCurrency = useCurrentOrPrev(amountInCurrency, true);
  const renderingFee = useCurrentOrPrev(fee, true);

  const {
    shouldRender: shouldRenderCurrency,
    transitionClassNames: currencyClassNames,
  } = useShowTransition(Boolean(amountInCurrency));

  const dropDownItems = useMemo(() => {
    if (!tokens) {
      return [];
    }

    return tokens.reduce<DropDownItem[]>((acc, token) => {
      if (token.amount > 0) {
        acc.push({
          value: token.slug,
          icon: token.image || ASSET_LOGO_PATHS[token.symbol.toLowerCase() as keyof typeof ASSET_LOGO_PATHS],
          name: token.symbol,
        });
      }

      return acc;
    }, []);
  }, [tokens]);

  const validateAndSetAmount = useCallback((newAmount: number | undefined, noReset = false) => {
    if (!noReset) {
      setShouldUseAllBalance(false);
      setHasAmountError(false);
      setIsInsufficientBalance(false);
    }

    if (newAmount === undefined) {
      setAmount(undefined);
      return;
    }

    if (Number.isNaN(newAmount) || newAmount < 0) {
      setHasAmountError(true);
      return;
    }

    if (!balance || newAmount > balance) {
      setHasAmountError(true);
      setIsInsufficientBalance(true);
    }

    setAmount(newAmount);
  }, [balance]);

  useEffect(() => {
    if (shouldUseAllBalance && balance) {
      const calculatedFee = fee ? bigStrToHuman(fee, decimals) : 0;
      const reducedAmount = balance - calculatedFee * RESERVED_FEE_FACTOR;
      validateAndSetAmount(reducedAmount, true);
    } else {
      validateAndSetAmount(amount, true);
    }
  }, [amount, balance, fee, decimals, shouldUseAllBalance, validateAndSetAmount]);

  useEffect(() => {
    if (!toAddress || hasToAddressError || !amount || !isAddressValid) {
      return;
    }

    runThrottled(() => {
      fetchFee({
        tokenSlug,
        toAddress,
        amount,
        comment,
      });
    });
  }, [amount, comment, fetchFee, hasToAddressError, isAddressValid, toAddress, tokenSlug]);

  const handleTokenChange = useCallback((slug: string) => {
    changeTransferToken({ tokenSlug: slug });
  }, [changeTransferToken]);

  const validateToAddress = useCallback(() => {
    setHasToAddressError(Boolean(toAddress) && !isAddressValid);
  }, [toAddress, isAddressValid]);

  const handleAddressFocus = useCallback(() => {
    const el = toAddressRef.current!;

    // `selectionStart` is only updated in the next frame after `focus` event
    requestAnimationFrame(() => {
      const caretPosition = el.selectionStart!;
      markAddressFocused();

      // Restore caret position after input field value has been focused and expanded
      requestAnimationFrame(() => {
        const newCaretPosition = caretPosition <= SHORT_ADDRESS_SHIFT + 3
          ? caretPosition
          : Math.max(0, el.value.length - (toAddressShort.length - caretPosition));

        el.setSelectionRange(newCaretPosition, newCaretPosition);
        if (newCaretPosition > SHORT_ADDRESS_SHIFT * 2) {
          el.scrollLeft = el.scrollWidth - el.clientWidth;
        }
      });
    });

    if (hasSavedAddresses) {
      openSavedAddresses();
    }
  }, [hasSavedAddresses, markAddressFocused, openSavedAddresses, toAddressShort.length]);

  const handleAddressBlur = useCallback(() => {
    if (dns.isDnsDomain(toAddress) && toAddress !== toAddress.toLowerCase()) {
      setToAddress(toAddress.toLowerCase());
    }

    validateToAddress();
    unmarkAddressFocused();

    if (hasSavedAddresses && isSavedAddressesOpen) {
      closeSavedAddresses();
    }
  }, [
    closeSavedAddresses, hasSavedAddresses, isSavedAddressesOpen, unmarkAddressFocused, validateToAddress, toAddress,
  ]);

  const handlePasteClick = useCallback(() => {
    navigator.clipboard
      .readText()
      .then((clipboardText) => {
        if (getIsAddressValid(clipboardText)) {
          setToAddress(clipboardText);
          validateToAddress();
        }
      })
      .catch(() => {
        showNotification({
          message: lang('Error reading clipboard') as string,
        });
        setShouldRenderPasteButton(false);
      });
  }, [lang, showNotification, validateToAddress]);

  const handleSavedAddressClick = useCallback((address: string) => {
    setToAddress(address);
    closeSavedAddresses();
  }, [closeSavedAddresses]);

  const handleDeleteSavedAddressClick = useCallback((address: string) => {
    setSavedAddressForDeletion(address);
    closeSavedAddresses();
  }, [closeSavedAddresses]);

  const closeDeleteSavedAddressModal = useCallback(() => {
    setSavedAddressForDeletion(undefined);
  }, []);

  const handleAmountChange = useCallback(validateAndSetAmount, [validateAndSetAmount]);

  const handleMaxAmountClick = useCallback((e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();

    if (!balance) {
      return;
    }

    setShouldUseAllBalance(true);
  }, [balance]);

  const handleCommentChange = useCallback((value) => {
    setComment(trimStringByMaxBytes(value, COMMENT_MAX_SIZE_BYTES));
  }, []);

  const canSubmit = toAddress.length
    && amount && balance && amount > 0 && amount <= balance
    && !hasToAddressError && !hasAmountError;

  const handleSubmit = useCallback((e) => {
    e.preventDefault();

    if (!canSubmit) {
      return;
    }

    submitTransferInitial({
      tokenSlug,
      amount: amount!,
      toAddress,
      comment,
    });
  }, [canSubmit, submitTransferInitial, tokenSlug, amount, toAddress, comment]);

  const renderedSavedAddresses = useMemo(() => {
    if (!savedAddresses) {
      return undefined;
    }

    return Object
      .keys(savedAddresses)
      .map((address) => renderSavedAddress(
        address,
        savedAddresses[address],
        lang('Delete') as string,
        handleSavedAddressClick,
        handleDeleteSavedAddressClick,
      ));
  }, [savedAddresses, lang, handleSavedAddressClick, handleDeleteSavedAddressClick]);

  function renderSavedAddresses() {
    return (
      <Menu
        positionX="right"
        type="suggestion"
        noBackdrop
        isOpen={isSavedAddressesOpen}
        onClose={closeSavedAddresses}
      >
        {renderedSavedAddresses}
      </Menu>
    );
  }

  function renderBottomRight() {
    const withFee = fee && amount && amount > 0;

    return (
      <Transition
        className={styles.amountBottomRight}
        name="fade"
        activeKey={isInsufficientBalance ? 2 : withFee ? 1 : 0}
      >
        {isInsufficientBalance ? (
          <span className={styles.balanceError}>{lang('Insufficient balance')}</span>
        ) : withFee ? (
          lang('$fee_value', {
            fee: (
              <span className={styles.feeValue}>
                {formatCurrencyExtended(bigStrToHuman(renderingFee!), CARD_SECONDARY_VALUE_SYMBOL, true)}
              </span>
            ),
          })
        ) : ' '}
      </Transition>
    );
  }

  function renderBalance() {
    if (!symbol) {
      return undefined;
    }

    return (
      <div className={styles.balanceContainer}>
        <span className={styles.balance}>
          {lang('$your_balance_is', {
            balance: (
              <a href="#" onClick={handleMaxAmountClick} className={styles.balanceLink}>
                {balance !== undefined
                  ? formatCurrencyExtended(balance, symbol, true)
                  : lang('Loading...')}
              </a>
            ),
          })}
        </span>
      </div>
    );
  }

  function renderTokens() {
    return (
      <DropDown
        items={dropDownItems}
        selectedValue={tokenSlug}
        className={styles.tokenDropDown}
        onChange={handleTokenChange}
      />
    );
  }

  function renderCurrencyValue() {
    return (
      <span className={buildClassName(styles.amountInCurrency, currencyClassNames)}>
        ≈&thinsp;{formatCurrency(renderingAmountInCurrency || 0, DEFAULT_PRICE_CURRENCY)}
      </span>
    );
  }

  return (
    <>
      <form className={modalStyles.transitionContent} onSubmit={handleSubmit}>
        <Input
          ref={toAddressRef}
          isRequired
          labelText={lang('Recipient address')}
          placeholder={lang('Wallet address or domain')}
          value={isAddressFocused ? toAddress : toAddressShort}
          error={hasToAddressError ? lang('Incorrect address') as string : undefined}
          onInput={setToAddress}
          onFocus={handleAddressFocus}
          onBlur={handleAddressBlur}
        >
          {shouldRenderPasteButton && toAddress === '' && (
            <Button
              isSimple
              className={styles.inputButton}
              onClick={handlePasteClick}
              ariaLabel={lang('Paste')}
            >
              <i className="icon-paste" />
            </Button>
          )}
        </Input>

        {hasSavedAddresses && renderSavedAddresses()}

        {renderBalance()}
        <RichNumberInput
          key="amount"
          id="amount"
          hasError={hasAmountError}
          value={amount}
          labelText={lang('Amount')}
          onChange={handleAmountChange}
          onPressEnter={handleSubmit}
          decimals={decimals}
          className={styles.amountInput}
        >
          {renderTokens()}
        </RichNumberInput>

        <div className={styles.amountBottomWrapper}>
          <div className={styles.amountBottom}>
            {shouldRenderCurrency && renderCurrencyValue()}
            {renderBottomRight()}
          </div>
        </div>

        <Input
          labelText={lang('Comment')}
          placeholder={lang('Optional')}
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
            {lang('$send_token_symbol', symbol || 'TON')}
          </Button>
        </div>
      </form>
      <DeleteSavedAddressModal
        isOpen={Boolean(savedAddressForDeletion)}
        address={savedAddressForDeletion}
        onClose={closeDeleteSavedAddressModal}
      />
    </>
  );
}

export default memo(withGlobal((global): StateProps => {
  const {
    toAddress: initialAddress,
    amount: initialAmount,
    comment: initialComment,
    fee,
    tokenSlug,
    isLoading,
  } = global.currentTransfer;

  return {
    initialAddress,
    initialAmount,
    initialComment,
    fee,
    tokenSlug,
    tokens: selectCurrentAccountTokens(global),
    isLoading,
    savedAddresses: selectCurrentAccountState(global)?.savedAddresses,
  };
})(TransferInitial));

function trimStringByMaxBytes(str: string, maxBytes: number) {
  const decoder = new TextDecoder('utf-8');
  const encoded = new TextEncoder().encode(str);

  return decoder.decode(encoded.slice(0, maxBytes)).replace(/\uFFFD/g, '');
}

function getIsAddressValid(address?: string) {
  return address && (
    TON_ADDRESS_REGEX.test(address)
    || TON_RAW_ADDRESS_REGEX.test(address)
    || dns.isDnsDomain(address)
  );
}

function renderSavedAddress(
  address: string,
  name: string,
  deleteLabel: string,
  onClick: (address: string) => void,
  onDeleteClick: (address: string) => void,
) {
  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    onDeleteClick(address);
  };

  return (
    <div
      key={address}
      tabIndex={-1}
      role="button"
      onMouseDown={() => onClick(address)}
      onTouchStart={() => onClick(address)}
      className={styles.savedAddressItem}
    >
      <span className={styles.savedAddressName}>{name}</span>
      <span className={styles.savedAddressDelete}>
        <span
          tabIndex={-1}
          role="button"
          className={styles.savedAddressDeleteInner}
          onMouseDown={handleDeleteClick}
        >
          {deleteLabel}
        </span>
      </span>
      <span className={styles.savedAddressAddress}>{shortenAddress(address)}</span>
    </div>
  );
}
