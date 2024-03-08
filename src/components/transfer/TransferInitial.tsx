import type { URLOpenListenerEvent } from '@capacitor/app';
import { App as CapacitorApp } from '@capacitor/app';
import React, {
  memo, useEffect, useMemo, useRef, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiBaseCurrency } from '../../api/types';
import type { UserToken } from '../../global/types';
import type { DropdownItem } from '../ui/Dropdown';
import { ElectronEvent } from '../../electron/types';
import { QrScanType, TransferState } from '../../global/types';

import {
  EXCHANGE_ADDRESSES, IS_FIREFOX_EXTENSION, TON_SYMBOL, TON_TOKEN_SLUG,
} from '../../config';
import {
  selectCurrentAccountState,
  selectCurrentAccountTokens,
  selectIsHardwareAccount,
} from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { clearLaunchUrl, getLaunchUrl } from '../../util/capacitor';
import { readClipboardContent } from '../../util/clipboard';
import { fromDecimal, toBig, toDecimal } from '../../util/decimals';
import dns from '../../util/dns';
import { formatCurrency, formatCurrencyExtended, getShortCurrencySymbol } from '../../util/formatNumber';
import { getIsAddressValid } from '../../util/getIsAddressValid';
import { throttle } from '../../util/schedulers';
import { shortenAddress } from '../../util/shortenAddress';
import stopEvent from '../../util/stopEvent';
import { parseTonDeeplink } from '../../util/ton/deeplinks';
import { IS_ANDROID, IS_FIREFOX, IS_TOUCH_ENV } from '../../util/windowEnvironment';
import { ASSET_LOGO_PATHS } from '../ui/helpers/assetLogos';

import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';
import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useQrScannerSupport from '../../hooks/useQrScannerSupport';
import useShowTransition from '../../hooks/useShowTransition';

import DeleteSavedAddressModal from '../main/modals/DeleteSavedAddressModal';
import Button from '../ui/Button';
import Dropdown from '../ui/Dropdown';
import Input from '../ui/Input';
import Menu from '../ui/Menu';
import RichNumberInput from '../ui/RichNumberInput';
import Transition from '../ui/Transition';

import modalStyles from '../ui/Modal.module.scss';
import styles from './Transfer.module.scss';

interface OwnProps {
  isStatic?: boolean;
  onCommentChange?: NoneToVoidFunction;
}

interface StateProps {
  toAddress?: string;
  amount?: bigint;
  comment?: string;
  shouldEncrypt?: boolean;
  isLoading?: boolean;
  fee?: bigint;
  tokenSlug?: string;
  tokens?: UserToken[];
  savedAddresses?: Record<string, string>;
  isEncryptedCommentSupported: boolean;
  isCommentSupported: boolean;
  baseCurrency?: ApiBaseCurrency;
}

const SAVED_ADDRESS_OPEN_DELAY = 300;
const COMMENT_MAX_SIZE_BYTES = 5000;
const SHORT_ADDRESS_SHIFT = 14;
const MIN_ADDRESS_LENGTH_TO_SHORTEN = SHORT_ADDRESS_SHIFT * 2;
const COMMENT_DROPDOWN_ITEMS = [
  { value: 'raw', name: 'Comment or Memo' },
  { value: 'encrypted', name: 'Encrypted Message' },
];
const ACTIVE_STATES = new Set([TransferState.Initial, TransferState.None]);

const INPUT_CLEAR_BUTTON_ID = 'input-clear-button';

const runThrottled = throttle((cb) => cb(), 1500, true);

function TransferInitial({
  isStatic,
  tokenSlug = TON_TOKEN_SLUG,
  toAddress = '',
  amount,
  comment = '',
  shouldEncrypt,
  tokens,
  fee,
  savedAddresses,
  isEncryptedCommentSupported,
  isCommentSupported,
  isLoading,
  onCommentChange,
  baseCurrency,
}: OwnProps & StateProps) {
  const {
    submitTransferInitial,
    showNotification,
    fetchFee,
    changeTransferToken,
    setTransferAmount,
    setTransferToAddress,
    setTransferComment,
    setTransferShouldEncrypt,
    cancelTransfer,
    requestOpenQrScanner,
  } = getActions();

  // eslint-disable-next-line no-null/no-null
  const toAddressRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line no-null/no-null
  const savedAddressesTimeoutRef = useRef<number>(null);

  const lang = useLang();

  // Note: As of 27-11-2023, Firefox does not support readText()
  const [shouldRenderPasteButton, setShouldRenderPasteButton] = useState(!(IS_FIREFOX || IS_FIREFOX_EXTENSION));
  const [isAddressFocused, markAddressFocused, unmarkAddressFocused] = useFlag();
  const [isSavedAddressesOpen, openSavedAddresses, closeSavedAddresses] = useFlag();
  const [savedAddressForDeletion, setSavedAddressForDeletion] = useState<string | undefined>();
  const [hasToAddressError, setHasToAddressError] = useState<boolean>(false);
  const [hasAmountError, setHasAmountError] = useState<boolean>(false);
  const [isInsufficientBalance, setIsInsufficientBalance] = useState<boolean>(false);
  const [isInsufficientFee, setIsInsufficientFee] = useState(false);
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

  const tonToken = useMemo(() => tokens?.find((token) => token.slug === TON_TOKEN_SLUG), [tokens])!;

  const isQrScannerSupported = useQrScannerSupport();

  const amountInCurrency = price && amount ? toBig(amount, decimals).mul(price).round(decimals).toString() : undefined;
  const renderingAmountInCurrency = useCurrentOrPrev(amountInCurrency, true);
  const renderingFee = useCurrentOrPrev(fee, true);
  const withPasteButton = shouldRenderPasteButton && toAddress === '';
  const withAddressClearButton = !!toAddress.length;
  const shortBaseSymbol = getShortCurrencySymbol(baseCurrency);

  const additionalAmount = amount && tokenSlug === TON_TOKEN_SLUG ? amount : 0n;
  const isEnoughTon = fee && (fee + additionalAmount) <= tonToken.amount;

  const { shouldRender: shouldRenderCurrency, transitionClassNames: currencyClassNames } = useShowTransition(
    Boolean(amountInCurrency),
  );

  const dropDownItems = useMemo(() => {
    if (!tokens) {
      return [];
    }

    return tokens.reduce<DropdownItem[]>((acc, token) => {
      if (token.amount > 0 || token.slug === tokenSlug) {
        acc.push({
          value: token.slug,
          icon: token.image || ASSET_LOGO_PATHS[token.symbol.toLowerCase() as keyof typeof ASSET_LOGO_PATHS],
          name: token.symbol,
        });
      }

      return acc;
    }, []);
  }, [tokenSlug, tokens]);

  const validateAndSetAmount = useLastCallback(
    (newAmount: bigint | undefined, noReset = false) => {
      if (!noReset) {
        setHasAmountError(false);
        setIsInsufficientBalance(false);
        setIsInsufficientFee(false);
      }

      if (newAmount === undefined) {
        setTransferAmount({ amount: undefined });
        return;
      }

      if (newAmount < 0) {
        setHasAmountError(true);
        return;
      }

      const tonAmount = tokenSlug === TON_TOKEN_SLUG ? newAmount : 0n;

      if (!balance || newAmount > balance) {
        setHasAmountError(true);
        setIsInsufficientBalance(true);
      } else if (fee && (fee + tonAmount > tonToken.amount)) {
        setIsInsufficientFee(true);
      }

      setTransferAmount({ amount: newAmount });
    },
  );

  useEffect(() => {
    if (
      tokenSlug === TON_TOKEN_SLUG
      && balance && amount && fee
      && amount <= balance
      && fee < balance
      && amount + fee >= balance
    ) {
      validateAndSetAmount(balance - fee);
    } else {
      validateAndSetAmount(amount);
    }
  }, [tokenSlug, amount, balance, fee, decimals, validateAndSetAmount]);

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

  const processDeeplink = useLastCallback((url: string) => {
    const params = parseTonDeeplink(url);
    if (!params) return;

    setTransferToAddress({ toAddress: params.to });
    setTransferAmount({ amount: params.amount });
    setTransferComment({ comment: params.comment });
  });

  useEffect(() => {
    return window.electron?.on(ElectronEvent.DEEPLINK, ({ url }: { url: string }) => {
      processDeeplink(url);
    });
  }, [processDeeplink]);

  useEffect(() => {
    const launchUrl = getLaunchUrl();
    if (launchUrl) {
      processDeeplink(launchUrl);
      clearLaunchUrl();
    }

    return CapacitorApp.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
      processDeeplink(event.url);
    }).remove;
  }, [processDeeplink]);

  const handleTokenChange = useLastCallback(
    (slug: string) => {
      changeTransferToken({ tokenSlug: slug });
    },
  );

  const validateToAddress = useLastCallback(() => {
    setHasToAddressError(Boolean(toAddress) && !isAddressValid);
  });

  const handleAddressFocus = useLastCallback(() => {
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
      // Simultaneous opening of the virtual keyboard and display of Saved Addresses causes animation degradation
      if (IS_ANDROID) {
        savedAddressesTimeoutRef.current = window.setTimeout(openSavedAddresses, SAVED_ADDRESS_OPEN_DELAY);
      } else {
        openSavedAddresses();
      }
    }
  });

  const handleAddressBlur = useLastCallback((e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    unmarkAddressFocused();

    if (e.relatedTarget?.id === INPUT_CLEAR_BUTTON_ID) return;

    if (dns.isDnsDomain(toAddress) && toAddress !== toAddress.toLowerCase()) {
      setTransferToAddress({ toAddress: toAddress.toLowerCase() });
    }

    validateToAddress();

    if (hasSavedAddresses && isSavedAddressesOpen) {
      closeSavedAddresses();
      if (savedAddressesTimeoutRef.current) {
        window.clearTimeout(savedAddressesTimeoutRef.current);
      }
    }
  });

  const handleAddressInput = useLastCallback((newToAddress: string) => {
    setTransferToAddress({ toAddress: newToAddress });
  });

  const handleAddressClearClick = useLastCallback(() => {
    setTransferToAddress({ toAddress: undefined });
    setHasToAddressError(false);
  });

  const handleQrScanClick = useLastCallback(() => {
    cancelTransfer();
    requestOpenQrScanner({ info: QrScanType.Transfer });
  });

  const handlePasteClick = useLastCallback(async () => {
    try {
      const { type, text } = await readClipboardContent();

      if (type === 'text/plain' && getIsAddressValid(text.trim())) {
        setTransferToAddress({ toAddress: text.trim() });
        validateToAddress();
      }
    } catch (error) {
      showNotification({ message: lang('Error reading clipboard') });
      setShouldRenderPasteButton(false);
    }
  });

  const handleSavedAddressClick = useLastCallback(
    (address: string) => {
      setTransferToAddress({ toAddress: address });
      closeSavedAddresses();
    },
  );

  const handleDeleteSavedAddressClick = useLastCallback(
    (address: string) => {
      setSavedAddressForDeletion(address);
      closeSavedAddresses();
    },
  );

  const closeDeleteSavedAddressModal = useLastCallback(() => {
    setSavedAddressForDeletion(undefined);
  });

  const handleAmountChange = useLastCallback((stringValue?: string) => {
    const value = stringValue ? fromDecimal(stringValue, decimals) : undefined;
    validateAndSetAmount(value);
  });

  const handleMaxAmountClick = useLastCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      e.preventDefault();

      if (!balance) {
        return;
      }

      setTransferAmount({ amount: balance });
    },
  );

  const handleCommentChange = useLastCallback((value) => {
    setTransferComment({ comment: trimStringByMaxBytes(value, COMMENT_MAX_SIZE_BYTES) });
    onCommentChange?.();
  });

  const isCommentRequired = Boolean(toAddress) && EXCHANGE_ADDRESSES.has(toAddress);
  const hasCommentError = isCommentRequired && !comment;

  const canSubmit = toAddress.length && amount && balance && amount > 0
    && amount <= balance && !hasToAddressError && !hasAmountError && isEnoughTon && !hasCommentError;

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
      shouldEncrypt,
    });
  });

  const handleCommentOptionsChange = useLastCallback((option: string) => {
    setTransferShouldEncrypt({ shouldEncrypt: option === 'encrypted' });
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

    const activeKey = isInsufficientBalance ? 0
      : isInsufficientFee ? 1
        : withFee ? 2
          : 3;

    const insufficientBalanceText = <span className={styles.balanceError}>{lang('Insufficient balance')}</span>;
    const insufficientFeeText = withFee ? (
      <span className={styles.balanceError}>
        {lang('$insufficient_fee', {
          fee: formatCurrencyExtended(toDecimal(renderingFee!), TON_SYMBOL, true),
        })}
      </span>
    ) : ' ';
    const feeText = withFee ? lang('$fee_value', {
      fee: (
        <span className={styles.feeValue}>
          {formatCurrencyExtended(toDecimal(renderingFee!), TON_SYMBOL, true)}
        </span>
      ),
    }) : ' ';

    const content = isInsufficientBalance ? insufficientBalanceText
      : isInsufficientFee ? insufficientFeeText
        : withFee ? feeText
          : ' ';

    return (
      <Transition
        className={buildClassName(styles.amountBottomRight, isStatic && styles.amountBottomRight_static)}
        slideClassName={styles.amountBottomRight_slide}
        name="fade"
        activeKey={activeKey}
      >
        {content}
      </Transition>
    );
  }

  function renderInputActions() {
    return (
      <Transition className={styles.inputButtonTransition} activeKey={toAddress.length ? 0 : 1} name="fade">
        {toAddress.length ? (
          <Button
            isSimple
            id={INPUT_CLEAR_BUTTON_ID}
            className={buildClassName(styles.inputButton, styles.inputButtonClear)}
            onClick={handleAddressClearClick}
            ariaLabel={lang('Clear')}
          >
            <i className="icon-close-filled" aria-hidden />
          </Button>
        ) : (
          <>
            {isQrScannerSupported && (
              <Button
                isSimple
                className={buildClassName(styles.inputButton, withPasteButton && styles.inputButtonShifted)}
                onClick={handleQrScanClick}
                ariaLabel={lang('Scan QR Code')}
              >
                <i className="icon-qr-scanner-alt" aria-hidden />
              </Button>
            )}
            {withPasteButton && (
              <Button isSimple className={styles.inputButton} onClick={handlePasteClick} ariaLabel={lang('Paste')}>
                <i className="icon-paste" aria-hidden />
              </Button>
            )}
          </>
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
          {lang('$max_balance', {
            balance: (
              <div
                role="button"
                tabIndex={0}
                onClick={handleMaxAmountClick}
                className={styles.balanceLink}
              >
                {balance !== undefined ? formatCurrency(toDecimal(balance, decimals), symbol) : lang('Loading...')}
              </div>
            ),
          })}
        </span>
      </div>
    );
  }

  function renderTokens() {
    return (
      <Dropdown
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
        ≈&thinsp;{formatCurrency(renderingAmountInCurrency || '0', shortBaseSymbol)}
      </span>
    );
  }

  function renderCommentLabel() {
    return (
      <Dropdown
        items={isEncryptedCommentSupported ? COMMENT_DROPDOWN_ITEMS : [COMMENT_DROPDOWN_ITEMS[0]]}
        selectedValue={COMMENT_DROPDOWN_ITEMS[shouldEncrypt ? 1 : 0].value}
        theme="light"
        menuPositionHorizontal="left"
        shouldTranslateOptions
        className={styles.commentLabel}
        onChange={handleCommentOptionsChange}
      />
    );
  }

  const withButton = isQrScannerSupported || withPasteButton || withAddressClearButton;

  return (
    <>
      <form className={isStatic ? undefined : modalStyles.transitionContent} onSubmit={handleSubmit}>
        <Input
          ref={toAddressRef}
          className={buildClassName(isStatic && styles.inputStatic, withButton && styles.inputWithIcon)}
          isRequired
          label={lang('Recipient Address')}
          placeholder={lang('Wallet address or domain')}
          value={isAddressFocused ? toAddress : toAddressShort}
          error={hasToAddressError ? (lang('Incorrect address') as string) : undefined}
          onInput={handleAddressInput}
          onFocus={handleAddressFocus}
          onBlur={handleAddressBlur}
        >
          {renderInputActions()}
        </Input>

        {hasSavedAddresses && renderSavedAddresses()}

        {renderBalance()}
        <RichNumberInput
          key="amount"
          id="amount"
          hasError={hasAmountError}
          value={amount === undefined ? undefined : toDecimal(amount, decimals)}
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

        {isCommentSupported && (
          <Input
            wrapperClassName={styles.commentInputWrapper}
            className={isStatic ? styles.inputStatic : undefined}
            label={renderCommentLabel()}
            placeholder={isCommentRequired ? lang('Required') : lang('Optional')}
            value={comment}
            isControlled
            isMultiline
            onInput={handleCommentChange}
            isRequired={isCommentRequired}
          />
        )}

        <div className={modalStyles.buttons}>
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
  withGlobal<OwnProps>(
    (global): StateProps => {
      const {
        toAddress,
        amount,
        comment,
        shouldEncrypt,
        fee,
        tokenSlug,
        isLoading,
        state,
      } = global.currentTransfer;

      const isLedger = selectIsHardwareAccount(global);
      const accountState = selectCurrentAccountState(global);
      const baseCurrency = global.settings.baseCurrency;

      return {
        toAddress,
        amount,
        comment,
        shouldEncrypt,
        fee,
        tokenSlug,
        tokens: selectCurrentAccountTokens(global),
        savedAddresses: accountState?.savedAddresses,
        isEncryptedCommentSupported: !isLedger,
        isCommentSupported: !tokenSlug || tokenSlug === TON_TOKEN_SLUG || !isLedger,
        isLoading: isLoading && ACTIVE_STATES.has(state),
        baseCurrency,
      };
    },
    (global, _, stickToFirst) => stickToFirst(global.currentAccountId),
  )(TransferInitial),
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
      <span
        className={styles.savedAddressDeleteIcon}
        role="button"
        tabIndex={-1}
        onMouseDown={handleDeleteClick}
        onClick={stopEvent}
        aria-label={deleteLabel}
      >
        <i className="icon-trash" aria-hidden />
      </span>
    </div>
  );
}
