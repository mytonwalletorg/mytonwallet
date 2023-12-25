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

import { IS_FIREFOX_EXTENSION, TON_SYMBOL, TON_TOKEN_SLUG } from '../../config';
import { bigStrToHuman } from '../../global/helpers';
import {
  selectCurrentAccountState,
  selectCurrentAccountTokens,
  selectIsHardwareAccount,
} from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { clearLaunchUrl, getLaunchUrl } from '../../util/capacitor';
import dns from '../../util/dns';
import {
  formatCurrency,
  formatCurrencyExtended,
  formatCurrencySimple,
  getShortCurrencySymbol,
} from '../../util/formatNumber';
import { getIsAddressValid } from '../../util/getIsAddressValid';
import { throttle } from '../../util/schedulers';
import { shortenAddress } from '../../util/shortenAddress';
import stopEvent from '../../util/stopEvent';
import { parseTonDeeplink } from '../../util/ton/deeplinks';
import { IS_FIREFOX, IS_TOUCH_ENV } from '../../util/windowEnvironment';
import { ASSET_LOGO_PATHS } from '../ui/helpers/assetLogos';

import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';
import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
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
  onQrScanPress?: NoneToVoidFunction;
  onCommentChange?: NoneToVoidFunction;
}

interface StateProps {
  toAddress?: string;
  amount?: number;
  comment?: string;
  shouldEncrypt?: boolean;
  isLoading?: boolean;
  fee?: string;
  tokenSlug?: string;
  tokens?: UserToken[];
  savedAddresses?: Record<string, string>;
  isEncryptedCommentSupported: boolean;
  isCommentSupported: boolean;
  baseCurrency?: ApiBaseCurrency;
}

const COMMENT_MAX_SIZE_BYTES = 5000;
const SHORT_ADDRESS_SHIFT = 14;
const MIN_ADDRESS_LENGTH_TO_SHORTEN = SHORT_ADDRESS_SHIFT * 2;
const COMMENT_DROPDOWN_ITEMS = [{ value: 'raw', name: 'Comment' }, { value: 'encrypted', name: 'Encrypted Message' }];

// Fee may change, so we add 5% for more reliability. This is only safe for low-fee blockchains such as TON.
const RESERVED_FEE_FACTOR = 1.05;

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
  onQrScanPress,
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
  } = getActions();

  // eslint-disable-next-line no-null/no-null
  const toAddressRef = useRef<HTMLInputElement>(null);

  const lang = useLang();

  // Note: As of 27-11-2023, Firefox does not support readText()
  const [shouldRenderPasteButton, setShouldRenderPasteButton] = useState(!(IS_FIREFOX || IS_FIREFOX_EXTENSION));
  const [isAddressFocused, markAddressFocused, unmarkAddressFocused] = useFlag();
  const [isSavedAddressesOpen, openSavedAddresses, closeSavedAddresses] = useFlag();
  const [savedAddressForDeletion, setSavedAddressForDeletion] = useState<string | undefined>();
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
  const withPasteButton = shouldRenderPasteButton && toAddress === '';
  const withQrScanButton = Boolean(onQrScanPress);
  const shortBaseSymbol = getShortCurrencySymbol(baseCurrency);

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
    (newAmount: number | undefined, noReset = false) => {
      if (!noReset) {
        setHasAmountError(false);
        setIsInsufficientBalance(false);
      }

      if (newAmount === undefined) {
        setTransferAmount({ amount: undefined });
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

      setTransferAmount({ amount: newAmount });
    },
  );

  useEffect(() => {
    if (balance && amount === balance) {
      const calculatedFee = fee ? bigStrToHuman(fee, decimals) : 0;
      const reducedAmount = balance - calculatedFee * RESERVED_FEE_FACTOR;
      const newAmount = tokenSlug === TON_TOKEN_SLUG && reducedAmount > 0 ? reducedAmount : balance;
      validateAndSetAmount(newAmount);
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
    setTransferAmount({ amount: params.amount ? bigStrToHuman(params.amount) : undefined });
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
      openSavedAddresses();
    }
  });

  const handleAddressBlur = useLastCallback(() => {
    if (dns.isDnsDomain(toAddress) && toAddress !== toAddress.toLowerCase()) {
      setTransferToAddress({ toAddress: toAddress.toLowerCase() });
    }

    validateToAddress();
    unmarkAddressFocused();

    if (hasSavedAddresses && isSavedAddressesOpen) {
      closeSavedAddresses();
    }
  });

  const handleAddressInput = useLastCallback((newToAddress: string) => {
    setTransferToAddress({ toAddress: newToAddress });
  });

  const handleQrScanClick = useLastCallback(() => {
    cancelTransfer();
    onQrScanPress!();
  });

  const handlePasteClick = useLastCallback(() => {
    navigator.clipboard
      .readText()
      .then((clipboardText) => {
        if (getIsAddressValid(clipboardText)) {
          setTransferToAddress({ toAddress: clipboardText });
          validateToAddress();
        }
      })
      .catch(() => {
        showNotification({
          message: lang('Error reading clipboard') as string,
        });
        setShouldRenderPasteButton(false);
      });
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

  const handleAmountChange = useLastCallback(validateAndSetAmount);

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
                {formatCurrencyExtended(bigStrToHuman(renderingFee!), TON_SYMBOL, true)}
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
          {lang('$max_balance', {
            balance: (
              <a href="#" onClick={handleMaxAmountClick} className={styles.balanceLink}>
                {balance !== undefined ? formatCurrencySimple(balance, symbol, decimals) : lang('Loading...')}
              </a>
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
        ≈&thinsp;{formatCurrency(renderingAmountInCurrency || 0, shortBaseSymbol)}
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

  return (
    <>
      <form className={isStatic ? undefined : modalStyles.transitionContent} onSubmit={handleSubmit}>
        <Input
          ref={toAddressRef}
          className={buildClassName(isStatic && styles.inputStatic, withQrScanButton && styles.inputWithIcon)}
          isRequired
          label={lang('Recipient Address')}
          placeholder={lang('Wallet address or domain')}
          value={isAddressFocused ? toAddress : toAddressShort}
          error={hasToAddressError ? (lang('Incorrect address') as string) : undefined}
          onInput={handleAddressInput}
          onFocus={handleAddressFocus}
          onBlur={handleAddressBlur}
        >
          {withQrScanButton && (
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

        {isCommentSupported && (
          <Input
            wrapperClassName={styles.commentInputWrapper}
            className={isStatic ? styles.inputStatic : undefined}
            label={renderCommentLabel()}
            placeholder={lang('Optional')}
            value={comment}
            isControlled
            isMultiline
            onInput={handleCommentChange}
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
        isLoading,
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
