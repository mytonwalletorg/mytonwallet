import React, {
  memo, useCallback, useEffect, useMemo, useState,
} from '../../lib/teact/teact';
import { withGlobal, getActions } from '../../global';

import { UserToken } from '../../global/types';

import { CARD_SECONDARY_VALUE_SYMBOL, TON_TOKEN_SLUG } from '../../config';
import { ASSET_LOGO_PATHS } from '../ui/helpers/assetLogos';
import { selectAllTokens } from '../../global/selectors';
import { shortenAddress } from '../../util/shortenAddress';
import { formatCurrencyExtended } from '../../util/formatNumber';
import { throttle } from '../../util/schedulers';
import { bigStrToHuman } from '../../global/helpers';
import useFlag from '../../hooks/useFlag';

import Button from '../ui/Button';
import Input from '../ui/Input';
import InputNumberRich from '../ui/InputNumberRich';
import Menu from '../ui/Menu';
import DeleteSavedAddressModal from '../main/DeleteSavedAddressModal';
import DropDown, { DropDownItem } from '../ui/DropDown';

import styles from './Transfer.module.scss';
import modalStyles from '../ui/Modal.module.scss';

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
const TON_DNS_REGEX = /^[-\da-z]{4,126}\.ton$/;
const COMMENT_MAX_SIZE_BYTES = 121; // Value derived empirically
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

  const [shouldUseAllBalance, setShouldUseAllBalance] = useState<boolean>(false);
  const [shouldRenderPasteButton, setShouldRenderPasteButton] = useState<boolean>(true);
  const [isSavedAddressesOpen, openSavedAddresses, closeSavedAddresses] = useFlag();
  const [savedAddressForDeletion, setSavedAddressForDeletion] = useState<string | undefined>();
  const [toAddress, setToAddress] = useState<string>(initialAddress);
  const [amount, setAmount] = useState<number | undefined>(initialAmount);
  const [comment, setComment] = useState<string>(initialComment);
  const [hasToAddressError, setHasToAddressError] = useState<boolean>(false);
  const [hasAmountError, setHasAmountError] = useState<boolean>(false);
  const [isInsufficientBalance, setIsInsufficientBalance] = useState<boolean>(false);
  const shouldRenderFee = fee && amount && amount > 0;
  const isAddressValid = getIsAddressValid(toAddress);
  const hasSavedAddresses = useMemo(() => {
    return savedAddresses && Object.keys(savedAddresses).length > 0;
  }, [savedAddresses]);

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

  const selectedToken = useMemo(() => {
    return tokens?.find((token) => token.slug === tokenSlug);
  }, [tokenSlug, tokens]);

  const balance = selectedToken?.amount;

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

  const handleAddressBlur = useCallback(() => {
    validateToAddress();
    if (hasSavedAddresses && isSavedAddressesOpen) {
      closeSavedAddresses();
    }
  }, [closeSavedAddresses, hasSavedAddresses, isSavedAddressesOpen, validateToAddress]);

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
          message: 'Error reading clipboard',
        });
        setShouldRenderPasteButton(false);
      });
  }, [showNotification, validateToAddress]);

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
        handleSavedAddressClick,
        handleDeleteSavedAddressClick,
      ));
  }, [savedAddresses, handleDeleteSavedAddressClick, handleSavedAddressClick]);

  function renderSavedAddresses() {
    return (
      <Menu
        bubbleClassName={styles.savedAddresses}
        positionX="right"
        noBackdrop
        isOpen={isSavedAddressesOpen}
        onClose={closeSavedAddresses}
      >
        {renderedSavedAddresses}
      </Menu>
    );
  }

  function renderFee() {
    return (
      <div>
        Fee:
        <span className={styles.feeValue}>
          {formatCurrencyExtended(bigStrToHuman(fee!), CARD_SECONDARY_VALUE_SYMBOL, true)}
        </span>
      </div>
    );
  }

  function renderBalance() {
    if (!selectedToken) {
      return undefined;
    }

    return (
      <span className={styles.note}>
        Your balance:{' '}
        <a href="#" onClick={handleMaxAmountClick} className={styles.balanceLink}>
          {balance !== undefined
            ? formatCurrencyExtended(balance, selectedToken.symbol, true)
            : 'Loading...'}
        </a>
      </span>
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

  return (
    <>
      <form className={modalStyles.transitionContent} onSubmit={handleSubmit}>
        <Input
          isRequired
          labelText="Recipient address"
          placeholder="Wallet address or domain"
          value={toAddress}
          error={hasToAddressError ? 'Incorrect address' : undefined}
          onInput={setToAddress}
          onFocus={hasSavedAddresses ? openSavedAddresses : undefined}
          onBlur={handleAddressBlur}
        >
          {shouldRenderPasteButton && toAddress === '' && (
            <Button
              isSimple
              className={styles.inputButton}
              onClick={handlePasteClick}
              ariaLabel="Paste"
            >
              <i className="icon-paste" />
            </Button>
          )}
        </Input>

        {hasSavedAddresses && renderSavedAddresses()}

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
          {renderTokens()}
        </InputNumberRich>
        <div className={styles.feeAndBalance}>
          {shouldRenderFee && renderFee()}
          {renderBalance()}
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
            Send {selectedToken?.symbol || 'TON'}
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
  } = global.currentTransfer;

  return {
    initialAddress,
    initialAmount,
    initialComment,
    fee,
    tokenSlug,
    tokens: selectAllTokens(global),
    isLoading: global.currentTransfer.isLoading,
    savedAddresses: global.savedAddresses,
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
    || TON_DNS_REGEX.test(address)
    || TON_RAW_ADDRESS_REGEX.test(address)
  );
}

function renderSavedAddress(
  address: string,
  name: string,
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
          Delete
        </span>
      </span>
      <span className={styles.savedAddressAddress}>{shortenAddress(address)}</span>
    </div>
  );
}
