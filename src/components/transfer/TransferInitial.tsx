import React, {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from '../../lib/teact/teact';

import { ElectronEvent } from '../../electron/types';
import type { UserToken } from '../../global/types';

import { CARD_SECONDARY_VALUE_SYMBOL, DEFAULT_PRICE_CURRENCY, TON_TOKEN_SLUG } from '../../config';
import { getActions, withGlobal } from '../../global';
import { bigStrToHuman } from '../../global/helpers';
import { selectCurrentAccountState, selectCurrentAccountTokens } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import dns from '../../util/dns';
import { formatCurrency, formatCurrencyExtended } from '../../util/formatNumber';
import { getIsAddressValid } from '../../util/getIsAddressValid';
import { throttle } from '../../util/schedulers';
import { shortenAddress } from '../../util/shortenAddress';
import { IS_TOUCH_ENV } from '../../util/windowEnvironment';
import { ASSET_LOGO_PATHS } from '../ui/helpers/assetLogos';

import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';
import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useShowTransition from '../../hooks/useShowTransition';

import DeleteSavedAddressModal from '../main/modals/DeleteSavedAddressModal';
import Button from '../ui/Button';
import type { DropdownItem } from '../ui/DropDown';
import DropDown from '../ui/DropDown';
import Input from '../ui/Input';
import Menu from '../ui/Menu';
import RichNumberInput from '../ui/RichNumberInput';
import Transition from '../ui/Transition';

import modalStyles from '../ui/Modal.module.scss';
import styles from './Transfer.module.scss';

interface OwnProps {
  isStatic?: boolean;
}

interface StateProps {
  initialAddress?: string;
  initialAmount?: number;
  initialComment?: string;
  initialShouldEncryptComment?: boolean;
  fee?: string;
  tokenSlug?: string;
  tokens?: UserToken[];
  savedAddresses?: Record<string, string>;
  isLoading?: boolean;
  onCommentChange?: NoneToVoidFunction;
}

const COMMENT_MAX_SIZE_BYTES = 121; // Value derived empirically
const SHORT_ADDRESS_SHIFT = 14;
const MIN_ADDRESS_LENGTH_TO_SHORTEN = SHORT_ADDRESS_SHIFT * 2;
const COMMENT_DROPDOWN_ITEMS = [{ value: 'raw', name: 'Comment' }, { value: 'encrypted', name: 'Encrypted Message' }];

// Fee may change, so we add 5% for more reliability. This is only safe for low-fee blockchains such as TON.
const RESERVED_FEE_FACTOR = 1.05;

const runThrottled = throttle((cb) => cb(), 1500, true);

function TransferInitial({
  isStatic,
  tokenSlug = TON_TOKEN_SLUG,
  initialAddress = '',
  initialAmount,
  initialComment = '',
  initialShouldEncryptComment,
  tokens,
  fee,
  savedAddresses,
  isLoading,
  onCommentChange,
}: OwnProps & StateProps) {
  const {
    submitTransferInitial, showNotification, fetchFee, changeTransferToken,
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
  const [shouldEncryptComment, setShouldEncryptComment] = useState(initialShouldEncryptComment);
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
    amount: balance,
    decimals,
    price,
    symbol,
  } = useMemo(() => tokens?.find((token) => token.slug === tokenSlug), [tokenSlug, tokens]) || {};
  const amountInCurrency = price && amount && !Number.isNaN(amount) ? amount * price : undefined;
  const renderingAmountInCurrency = useCurrentOrPrev(amountInCurrency, true);
  const renderingFee = useCurrentOrPrev(fee, true);

  const { shouldRender: shouldRenderCurrency, transitionClassNames: currencyClassNames } = useShowTransition(
    Boolean(amountInCurrency),
  );

  const dropDownItems = useMemo(() => {
    if (!tokens) {
      return [];
    }

    return tokens.reduce<DropdownItem[]>((acc, token) => {
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

  const validateAndSetAmount = useCallback(
    (newAmount: number | undefined, noReset = false) => {
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
    },
    [balance],
  );

  useEffect(() => {
    if (shouldUseAllBalance && balance) {
      const calculatedFee = fee ? bigStrToHuman(fee, decimals) : 0;
      const reducedAmount = balance - calculatedFee * RESERVED_FEE_FACTOR;
      const newAmount = tokenSlug === TON_TOKEN_SLUG ? reducedAmount : balance;
      validateAndSetAmount(newAmount, true);
    } else {
      validateAndSetAmount(amount, true);
    }
  }, [
    tokenSlug, amount, balance, fee,
    decimals, shouldUseAllBalance, validateAndSetAmount,
  ]);

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

  useEffect(() => {
    return window.electron?.on(ElectronEvent.DEEPLINK, (params: any) => {
      setToAddress(params.to);
      setAmount(bigStrToHuman(params.amount));
      setComment(params.text);
    });
  }, []);

  const handleTokenChange = useCallback(
    (slug: string) => {
      changeTransferToken({ tokenSlug: slug });
    },
    [changeTransferToken],
  );

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
    closeSavedAddresses,
    hasSavedAddresses,
    isSavedAddressesOpen,
    unmarkAddressFocused,
    validateToAddress,
    toAddress,
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

  const handleSavedAddressClick = useCallback(
    (address: string) => {
      setToAddress(address);
      closeSavedAddresses();
    },
    [closeSavedAddresses],
  );

  const handleDeleteSavedAddressClick = useCallback(
    (address: string) => {
      setSavedAddressForDeletion(address);
      closeSavedAddresses();
    },
    [closeSavedAddresses],
  );

  const closeDeleteSavedAddressModal = useCallback(() => {
    setSavedAddressForDeletion(undefined);
  }, []);

  const handleAmountChange = useCallback(validateAndSetAmount, [validateAndSetAmount]);

  const handleMaxAmountClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      e.preventDefault();

      if (!balance) {
        return;
      }

      setShouldUseAllBalance(true);
    },
    [balance],
  );

  const handleCommentChange = useCallback((value) => {
    setComment(trimStringByMaxBytes(value, COMMENT_MAX_SIZE_BYTES));
    onCommentChange?.();
  }, [onCommentChange]);

  const canSubmit = toAddress.length && amount && balance && amount > 0
    && amount <= balance && !hasToAddressError && !hasAmountError;

  const handleSubmit = useLastCallback((e) => {
    e.preventDefault();

    if (!canSubmit) {
      return;
    }

    submitTransferInitial({
      tokenSlug,
      amount: amount!,
      toAddress,
      comment,
      shouldEncrypt: shouldEncryptComment,
    });
  });

  const handleCommentOptionsChange = useLastCallback((option: string) => {
    setShouldEncryptComment(option === 'encrypted');
  });

  const renderedSavedAddresses = useMemo(() => {
    if (!savedAddresses) {
      return undefined;
    }

    return Object.keys(savedAddresses).map((address) => renderSavedAddress(
      address,
      savedAddresses[address],
      lang('Delete') as string,
      handleSavedAddressClick,
      handleDeleteSavedAddressClick,
    ));
  }, [savedAddresses, lang, handleSavedAddressClick, handleDeleteSavedAddressClick]);

  function renderSavedAddresses() {
    return (
      <Menu positionX="right" type="suggestion" noBackdrop isOpen={isSavedAddressesOpen} onClose={closeSavedAddresses}>
        {renderedSavedAddresses}
      </Menu>
    );
  }

  function renderBottomRight() {
    const withFee = fee && amount && amount > 0;

    return (
      <Transition
        className={buildClassName(styles.amountBottomRight, isStatic && styles.amountBottomRight_static)}
        slideClassName={styles.amountBottomRight_slide}
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
        ) : (
          ' '
        )}
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
                {balance !== undefined ? formatCurrencyExtended(balance, symbol, true) : lang('Loading...')}
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
        className={styles.tokenDropdown}
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

  function renderCommentLabel() {
    return (
      <DropDown
        items={COMMENT_DROPDOWN_ITEMS}
        selectedValue={COMMENT_DROPDOWN_ITEMS[shouldEncryptComment ? 1 : 0].value}
        theme="light"
        menuPositionHorizontal="left"
        shouldTranslateOptions
        className={styles.commentLabel}
        onChange={handleCommentOptionsChange}
      />
    );
  }

  return (
    <>
      <form className={isStatic ? undefined : modalStyles.transitionContent} onSubmit={handleSubmit}>
        <Input
          ref={toAddressRef}
          className={isStatic ? styles.inputStatic : undefined}
          isRequired
          label={lang('Recipient Address')}
          placeholder={lang('Wallet address or domain')}
          value={isAddressFocused ? toAddress : toAddressShort}
          error={hasToAddressError ? (lang('Incorrect address') as string) : undefined}
          onInput={setToAddress}
          onFocus={handleAddressFocus}
          onBlur={handleAddressBlur}
        >
          {shouldRenderPasteButton && toAddress === '' && (
            <Button isSimple className={styles.inputButton} onClick={handlePasteClick} ariaLabel={lang('Paste')}>
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
          inputClassName={isStatic ? styles.inputRichStatic : undefined}
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
          className={isStatic ? styles.inputStatic : undefined}
          label={renderCommentLabel()}
          placeholder={lang('Optional')}
          value={comment}
          onInput={handleCommentChange}
          isControlled
          isMultiline
        />

        <div className={buildClassName(modalStyles.buttons, isStatic && styles.buttonSubmit)}>
          <Button isPrimary isSubmit isDisabled={!canSubmit} isLoading={isLoading}>
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

export default memo(
  withGlobal((global): StateProps => {
    const {
      toAddress: initialAddress,
      amount: initialAmount,
      comment: initialComment,
      shouldEncrypt: initialShouldEncryptComment,
      fee,
      tokenSlug,
      isLoading,
    } = global.currentTransfer;

    return {
      initialAddress,
      initialAmount,
      initialComment,
      initialShouldEncryptComment,
      fee,
      tokenSlug,
      tokens: selectCurrentAccountTokens(global),
      isLoading,
      savedAddresses: selectCurrentAccountState(global)?.savedAddresses,
    };
  })(TransferInitial),
);

function trimStringByMaxBytes(str: string, maxBytes: number) {
  const decoder = new TextDecoder('utf-8');
  const encoded = new TextEncoder().encode(str);

  return decoder.decode(encoded.slice(0, maxBytes)).replace(/\uFFFD/g, '');
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
      onMouseDown={IS_TOUCH_ENV ? undefined : () => onClick(address)}
      onClick={IS_TOUCH_ENV ? () => onClick(address) : undefined}
      className={styles.savedAddressItem}
    >
      <span className={styles.savedAddressName}>{name}</span>
      <span className={styles.savedAddressDelete}>
        <span tabIndex={-1} role="button" className={styles.savedAddressDeleteInner} onMouseDown={handleDeleteClick}>
          {deleteLabel}
        </span>
      </span>
      <span className={styles.savedAddressAddress}>{shortenAddress(address)}</span>
    </div>
  );
}
