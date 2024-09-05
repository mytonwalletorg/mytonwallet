import type { TeactNode } from '../../lib/teact/teact';
import React, {
  memo, useEffect, useMemo, useRef, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiBaseCurrency, ApiNft } from '../../api/types';
import type { Account, DieselStatus, UserToken } from '../../global/types';
import type { DropdownItem } from '../ui/Dropdown';
import { TransferState } from '../../global/types';

import { IS_FIREFOX_EXTENSION, TON_SYMBOL, TONCOIN_SLUG } from '../../config';
import { Big } from '../../lib/big.js';
import renderText from '../../global/helpers/renderText';
import {
  selectCurrentAccountState,
  selectCurrentAccountTokens,
  selectIsHardwareAccount,
  selectNetworkAccounts,
} from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { vibrate } from '../../util/capacitor';
import { readClipboardContent } from '../../util/clipboard';
import { fromDecimal, toBig, toDecimal } from '../../util/decimals';
import dns from '../../util/dns';
import { formatCurrency, formatCurrencyExtended, getShortCurrencySymbol } from '../../util/formatNumber';
import { isTonAddressOrDomain } from '../../util/isTonAddressOrDomain';
import { throttle } from '../../util/schedulers';
import { shortenAddress } from '../../util/shortenAddress';
import stopEvent from '../../util/stopEvent';
import { IS_ANDROID, IS_FIREFOX, IS_TOUCH_ENV } from '../../util/windowEnvironment';
import { NFT_TRANSFER_AMOUNT } from '../../api/blockchains/ton/constants';
import { ASSET_LOGO_PATHS } from '../ui/helpers/assetLogos';

import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';
import useFlag from '../../hooks/useFlag';
import useInterval from '../../hooks/useInterval';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useQrScannerSupport from '../../hooks/useQrScannerSupport';
import useShowTransition from '../../hooks/useShowTransition';

import DeleteSavedAddressModal from '../main/modals/DeleteSavedAddressModal';
import Button from '../ui/Button';
import Dropdown from '../ui/Dropdown';
import Input from '../ui/Input';
import InteractiveTextField from '../ui/InteractiveTextField';
import Menu from '../ui/Menu';
import RichNumberInput from '../ui/RichNumberInput';
import Transition from '../ui/Transition';
import NftChips from './NftChips';
import NftInfo from './NftInfo';

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
  currentAccountId?: string;
  accounts?: Record<string, Account>;
  isEncryptedCommentSupported: boolean;
  isMemoRequired?: boolean;
  baseCurrency?: ApiBaseCurrency;
  nfts?: ApiNft[];
  binPayload?: string;
  stateInit?: string;
  dieselAmount?: bigint;
  dieselStatus?: DieselStatus;
  isDieselAuthorizationStarted?: boolean;
}

const SAVED_ADDRESS_OPEN_DELAY = 300;
const COMMENT_MAX_SIZE_BYTES = 5000;
const SHORT_ADDRESS_SHIFT = 12;
const MIN_ADDRESS_LENGTH_TO_SHORTEN = SHORT_ADDRESS_SHIFT * 2;
const COMMENT_DROPDOWN_ITEMS = [
  { value: 'raw', name: 'Comment or Memo' },
  { value: 'encrypted', name: 'Encrypted Message' },
];
const ACTIVE_STATES = new Set([TransferState.Initial, TransferState.None]);
const STAKED_TOKEN_SLUG = 'ton-eqcqc6ehrj';
const AUTHORIZE_DIESEL_INTERVAL_MS = 1000;

const INPUT_CLEAR_BUTTON_ID = 'input-clear-button';

const runThrottled = throttle((cb) => cb(), 1500, true);

function TransferInitial({
  isStatic,
  tokenSlug = TONCOIN_SLUG,
  toAddress = '',
  amount,
  comment = '',
  shouldEncrypt,
  tokens,
  fee,
  savedAddresses,
  accounts,
  currentAccountId,
  isEncryptedCommentSupported,
  isMemoRequired,
  isLoading,
  onCommentChange,
  baseCurrency,
  nfts,
  binPayload,
  stateInit,
  dieselAmount,
  dieselStatus,
  isDieselAuthorizationStarted,
}: OwnProps & StateProps) {
  const {
    submitTransferInitial,
    showNotification,
    fetchFee,
    fetchNftFee,
    changeTransferToken,
    setTransferAmount,
    setTransferToAddress,
    setTransferComment,
    setTransferShouldEncrypt,
    cancelTransfer,
    requestOpenQrScanner,
    showDialog,
    authorizeDiesel,
    fetchDieselState,
  } = getActions();

  // eslint-disable-next-line no-null/no-null
  const toAddressRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line no-null/no-null
  const addressBookTimeoutRef = useRef<number>(null);

  const lang = useLang();

  // Note: As of 27-11-2023, Firefox does not support readText()
  const [shouldRenderPasteButton, setShouldRenderPasteButton] = useState(!(IS_FIREFOX || IS_FIREFOX_EXTENSION));
  const [isAddressFocused, markAddressFocused, unmarkAddressFocused] = useFlag();
  const [isAddressBookOpen, openAddressBook, closeAddressBook] = useFlag();
  const [savedAddressForDeletion, setSavedAddressForDeletion] = useState<string | undefined>();
  const [hasToAddressError, setHasToAddressError] = useState<boolean>(false);
  const [hasAmountError, setHasAmountError] = useState<boolean>(false);
  const [isInsufficientBalance, setIsInsufficientBalance] = useState<boolean>(false);
  const [isInsufficientFee, setIsInsufficientFee] = useState(false);
  const isNftTransfer = Boolean(nfts?.length);
  const toAddressShort = toAddress.length > MIN_ADDRESS_LENGTH_TO_SHORTEN
    ? shortenAddress(toAddress, SHORT_ADDRESS_SHIFT) || ''
    : toAddress;
  const isAddressValid = isTonAddressOrDomain(toAddress);
  const otherAccountIds = useMemo(() => {
    return accounts ? Object.keys(accounts).filter((accountId) => accountId !== currentAccountId) : [];
  }, [currentAccountId, accounts]);
  const shouldUseAddressBook = useMemo(() => {
    return otherAccountIds.length > 0 || Object.keys(savedAddresses || {}).length > 0;
  }, [otherAccountIds.length, savedAddresses]);
  const {
    amount: balance,
    decimals,
    price,
    symbol,
  } = useMemo(() => tokens?.find((token) => token.slug === tokenSlug), [tokenSlug, tokens]) || {};

  const isToncoin = tokenSlug === TONCOIN_SLUG;
  const isTonFullBalance = isToncoin && balance === amount;
  const tonToken = useMemo(() => tokens?.find((token) => token.slug === TONCOIN_SLUG), [tokens])!;
  const shouldDisableClearButton = !toAddress && !amount && !(comment || binPayload) && !shouldEncrypt
    && !(nfts?.length && isStatic);

  const isQrScannerSupported = useQrScannerSupport();

  const amountInCurrency = price && amount
    ? toBig(amount, decimals).mul(price).round(decimals, Big.roundHalfUp).toString()
    : undefined;
  const renderingAmountInCurrency = useCurrentOrPrev(amountInCurrency, true);
  const renderingFee = useCurrentOrPrev(fee, true);
  const withPasteButton = shouldRenderPasteButton && toAddress === '';
  const withAddressClearButton = !!toAddress.length;
  const shortBaseSymbol = getShortCurrencySymbol(baseCurrency);

  const additionalAmount = amount && tokenSlug === TONCOIN_SLUG ? amount : 0n;
  const isEnoughToncoin = isTonFullBalance
    ? (fee && fee < tonToken.amount)
    : (fee && (fee + additionalAmount) <= tonToken.amount);

  const isDieselAvailable = dieselStatus === 'available';
  const isDieselNotAuthorized = dieselStatus === 'not-authorized';
  const withDiesel = dieselStatus && dieselStatus !== 'not-available';
  const isEnoughDiesel = withDiesel && amount && balance && dieselAmount
    ? balance - amount > dieselAmount
    : undefined;

  const authorizeDieselInterval = isDieselNotAuthorized && isDieselAuthorizationStarted && tokenSlug && !isToncoin
    ? AUTHORIZE_DIESEL_INTERVAL_MS
    : undefined;

  const { shouldRender: shouldRenderCurrency, transitionClassNames: currencyClassNames } = useShowTransition(
    Boolean(amountInCurrency),
  );

  const updateDieselState = useLastCallback(() => {
    fetchDieselState({ tokenSlug });
  });

  useInterval(updateDieselState, authorizeDieselInterval);

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

      const tonBalance = tonToken.amount;
      const tonAmount = isToncoin ? newAmount : 0n;

      if (!balance || newAmount > balance) {
        setHasAmountError(true);
        setIsInsufficientBalance(true);
      } else if (isToncoin && tonAmount === tonToken.amount) {
        // Do nothing
      } else if (fee && (fee >= tonBalance || (fee + tonAmount > tonBalance)) && !isDieselAvailable) {
        setIsInsufficientFee(true);
      }

      setTransferAmount({ amount: newAmount });
    },
  );

  useEffect(() => {
    if (
      isToncoin
      && balance && amount && fee
      && amount < balance
      && fee < balance
      && amount + fee >= balance
    ) {
      validateAndSetAmount(balance - fee);
    } else {
      validateAndSetAmount(amount);
    }
  }, [isToncoin, tokenSlug, amount, balance, fee, decimals, validateAndSetAmount, isDieselAvailable]);

  useEffect(() => {
    if (!toAddress || hasToAddressError || !(amount || nfts?.length) || !isAddressValid) {
      return;
    }

    runThrottled(() => {
      if (isNftTransfer) {
        fetchNftFee({
          toAddress,
          comment,
          nftAddresses: nfts?.map(({ address }) => address) || [],
        });
      } else {
        fetchFee({
          tokenSlug,
          toAddress,
          amount: amount!,
          comment,
          binPayload,
          stateInit,
        });
      }
    });
  }, [
    amount,
    binPayload,
    comment,
    hasToAddressError,
    isAddressValid,
    isNftTransfer,
    nfts,
    stateInit,
    toAddress,
    tokenSlug,
  ]);

  const handleTokenChange = useLastCallback(
    (slug: string) => {
      changeTransferToken({ tokenSlug: slug });
      if (slug === STAKED_TOKEN_SLUG) {
        showDialog({
          title: lang('Warning!'),
          // eslint-disable-next-line max-len
          message: lang('You are about to transfer an important service token, which is needed to withdraw your deposit from staking.'),
        });
      }
    },
  );

  const validateToAddress = useLastCallback(() => {
    setHasToAddressError(Boolean(toAddress) && !isAddressValid);
  });

  const handleAddressBookClose = useLastCallback(() => {
    if (!shouldUseAddressBook || !isAddressBookOpen) return;

    closeAddressBook();

    if (addressBookTimeoutRef.current) {
      window.clearTimeout(addressBookTimeoutRef.current);
    }
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

    if (shouldUseAddressBook) {
      // Simultaneous opening of the virtual keyboard and display of Saved Addresses causes animation degradation
      if (IS_ANDROID) {
        addressBookTimeoutRef.current = window.setTimeout(openAddressBook, SAVED_ADDRESS_OPEN_DELAY);
      } else {
        openAddressBook();
      }
    }
  });

  const handleAddressBlur = useLastCallback((e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    unmarkAddressFocused();

    if (e.relatedTarget?.id === INPUT_CLEAR_BUTTON_ID) {
      handleAddressBookClose();

      return;
    }

    if (dns.isDnsDomain(toAddress) && toAddress !== toAddress.toLowerCase()) {
      setTransferToAddress({ toAddress: toAddress.toLowerCase().trim() });
    } else if (toAddress !== toAddress.trim()) {
      setTransferToAddress({ toAddress: toAddress.trim() });
    }

    requestAnimationFrame(() => {
      validateToAddress();
      handleAddressBookClose();
    });
  });

  const handleAddressInput = useLastCallback((newToAddress: string) => {
    setTransferToAddress({ toAddress: newToAddress });
  });

  const handleAddressClearClick = useLastCallback(() => {
    setTransferToAddress({ toAddress: undefined });
    setHasToAddressError(false);
  });

  const handleQrScanClick = useLastCallback(() => {
    requestOpenQrScanner();
    cancelTransfer();
  });

  const handleClear = useLastCallback(() => {
    if (isStatic) {
      cancelTransfer({ shouldReset: true });
    } else {
      handleAddressClearClick();
      setTransferAmount({ amount: undefined });
      setTransferComment({ comment: undefined });
      setTransferShouldEncrypt({ shouldEncrypt: false });
      setHasAmountError(false);
      setIsInsufficientBalance(false);
      setIsInsufficientFee(false);
    }
  });

  const handlePasteClick = useLastCallback(async () => {
    try {
      const { type, text } = await readClipboardContent();

      if (type === 'text/plain' && isTonAddressOrDomain(text.trim())) {
        setTransferToAddress({ toAddress: text.trim() });
        validateToAddress();
      }
    } catch (err: any) {
      showNotification({ message: lang('Error reading clipboard') });
      setShouldRenderPasteButton(false);
    }
  });

  const handleAddressBookItemClick = useLastCallback(
    (address: string) => {
      setTransferToAddress({ toAddress: address });
      closeAddressBook();
    },
  );

  const handleDeleteSavedAddressClick = useLastCallback(
    (address: string) => {
      setSavedAddressForDeletion(address);
      closeAddressBook();
    },
  );

  const closeDeleteSavedAddressModal = useLastCallback(() => {
    setSavedAddressForDeletion(undefined);
  });

  const handleAmountChange = useLastCallback((stringValue?: string) => {
    const value = stringValue ? fromDecimal(stringValue, decimals) : undefined;
    validateAndSetAmount(value);
  });

  const handleMaxAmountClick = useLastCallback((e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();

    if (!balance) {
      return;
    }

    vibrate();

    setTransferAmount({ amount: balance });
  });

  const handleCommentChange = useLastCallback((value) => {
    setTransferComment({ comment: trimStringByMaxBytes(value, COMMENT_MAX_SIZE_BYTES) });
    onCommentChange?.();
  });

  const isCommentRequired = Boolean(toAddress) && isMemoRequired;
  const hasCommentError = isCommentRequired && !comment;
  const requiredAmount = isNftTransfer ? NFT_TRANSFER_AMOUNT : amount;

  const canSubmit = Boolean(toAddress.length && requiredAmount && balance && requiredAmount > 0
    && requiredAmount <= balance && !hasToAddressError && !hasAmountError
    && (isEnoughToncoin || isEnoughDiesel || isDieselNotAuthorized) && !hasCommentError
    && (!isNftTransfer || Boolean(nfts?.length)));

  const handleSubmit = useLastCallback((e) => {
    e.preventDefault();

    if (withDiesel && dieselStatus === 'not-authorized') {
      authorizeDiesel();
      return;
    }

    if (!canSubmit) {
      return;
    }

    vibrate();

    submitTransferInitial({
      tokenSlug,
      amount: isNftTransfer ? NFT_TRANSFER_AMOUNT : amount!,
      toAddress,
      comment,
      shouldEncrypt,
      nftAddresses: isNftTransfer ? nfts!.map(({ address }) => address) : undefined,
      withDiesel,
      stateInit,
    });
  });

  const handleCommentOptionsChange = useLastCallback((option: string) => {
    setTransferShouldEncrypt({ shouldEncrypt: option === 'encrypted' });
  });

  const renderedSavedAddresses = useMemo(() => {
    if (!savedAddresses) {
      return undefined;
    }

    return Object.keys(savedAddresses).map((address) => renderAddressItem({
      key: `saved-${address}`,
      address,
      name: savedAddresses[address],
      deleteLabel: lang('Delete'),
      onClick: handleAddressBookItemClick,
      onDeleteClick: handleDeleteSavedAddressClick,
    }));
  }, [savedAddresses, lang, handleAddressBookItemClick, handleDeleteSavedAddressClick]);

  const renderedOtherAccounts = useMemo(() => {
    if (otherAccountIds.length === 0) {
      return undefined;
    }

    const addressesToBeIgnored = Object.keys(savedAddresses || {});

    return otherAccountIds
      .filter((id) => !addressesToBeIgnored.includes(accounts![id].address))
      .map((id) => renderAddressItem({
        key: id,
        address: accounts![id].address,
        name: accounts![id].title,
        isHardware: accounts![id].isHardware,
        onClick: handleAddressBookItemClick,
      }));
  }, [otherAccountIds, savedAddresses, accounts, handleAddressBookItemClick]);

  function renderAddressBook() {
    return (
      <Menu
        positionX="right"
        type="suggestion"
        noBackdrop
        bubbleClassName={styles.savedAddressBubble}
        isOpen={isAddressBookOpen && !toAddress?.length}
        onClose={closeAddressBook}
      >
        {renderedSavedAddresses}
        {renderedOtherAccounts}
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

    const insufficientDieselText = withFee && dieselAmount && symbol ? (
      <span className={styles.balanceError}>
        {lang('$insufficient_fee', {
          fee: formatCurrencyExtended(toDecimal(dieselAmount!, decimals), symbol, true),
        })}
      </span>
    ) : ' ';

    let feeText: string | TeactNode[] = ' ';

    if (withDiesel && dieselAmount && symbol) {
      feeText = lang('$fee_value', {
        fee: (
          <span className={styles.feeValue}>
            {formatCurrencyExtended(toDecimal(dieselAmount!, decimals), symbol, true, decimals)}
          </span>
        ),
      });
    } else if (withFee) {
      feeText = lang('$fee_value', {
        fee: (
          <span className={styles.feeValue}>
            {formatCurrencyExtended(toDecimal(renderingFee!), TON_SYMBOL, true, tonToken.decimals)}
          </span>
        ),
      });
    }

    const content = isInsufficientBalance ? insufficientBalanceText
      : withDiesel && !isEnoughDiesel ? insufficientDieselText
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
    if (!symbol || nfts?.length) {
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
        ≈&thinsp;{formatCurrency(renderingAmountInCurrency || '0', shortBaseSymbol, undefined, true)}
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

  function renderButtonText() {
    if (!isEnoughToncoin && withDiesel && !isDieselAvailable) {
      if (dieselStatus === 'pending-previous') {
        return lang('Awaiting Previous Fee');
      } else {
        return lang('Authorize %token% Fee', { token: symbol! });
      }
    } else {
      return lang('$send_token_symbol', isNftTransfer ? 'NFT' : symbol || 'TON');
    }
  }

  return (
    <>
      <form className={isStatic ? undefined : modalStyles.transitionContent} onSubmit={handleSubmit}>
        {nfts?.length === 1 && <NftInfo nft={nfts[0]} isStatic={isStatic} />}
        {Boolean(nfts?.length) && nfts!.length > 1 && <NftChips nfts={nfts!} isStatic={isStatic} />}

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

        {shouldUseAddressBook && renderAddressBook()}

        {renderBalance()}
        {!isNftTransfer && (
          <>
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
          </>
        )}

        {binPayload || stateInit ? (
          <>
            {binPayload && (
              <>
                <div className={styles.label}>{lang('Signing Data')}</div>
                <InteractiveTextField
                  text={binPayload}
                  copyNotification={lang('Data was copied!')}
                  className={styles.addressWidget}
                />
              </>
            )}

            {stateInit && (
              <>
                <div className={styles.label}>{lang('Contract Initialization Data')}</div>
                <InteractiveTextField
                  text={stateInit}
                  copyNotification={lang('Data was copied!')}
                  className={styles.addressWidget}
                />
              </>
            )}

            <div className={styles.error}>
              {renderText(lang('$signature_warning'))}
            </div>
          </>
        ) : (
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

        <div className={styles.buttons}>
          <Button
            isDisabled={shouldDisableClearButton || isLoading}
            className={styles.button}
            onClick={handleClear}
          >
            {lang('Clear')}
          </Button>
          <Button
            isPrimary
            isSubmit
            isDisabled={!canSubmit}
            isLoading={isLoading}
            className={styles.button}
          >
            {renderButtonText()}
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
        nfts,
        binPayload,
        isMemoRequired,
        dieselStatus,
        dieselAmount,
        stateInit,
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
        nfts,
        tokenSlug,
        binPayload,
        stateInit,
        tokens: selectCurrentAccountTokens(global),
        savedAddresses: accountState?.savedAddresses,
        isEncryptedCommentSupported: !isLedger && !nfts?.length && !isMemoRequired,
        isMemoRequired,
        isLoading: isLoading && ACTIVE_STATES.has(state),
        baseCurrency,
        currentAccountId: global.currentAccountId,
        accounts: selectNetworkAccounts(global),
        dieselAmount,
        dieselStatus,
        isDieselAuthorizationStarted: accountState?.isDieselAuthorizationStarted,
      };
    },
    (global, { isStatic }, stickToFirst) => {
      if (!isStatic) {
        return stickToFirst(global.currentAccountId);
      }

      const { nfts, tokenSlug = TONCOIN_SLUG } = global.currentTransfer;
      const key = nfts?.length ? `${nfts[0].address}_${nfts.length}` : tokenSlug;

      return stickToFirst(`${global.currentAccountId}_${key}`);
    },
  )(TransferInitial),
);

function trimStringByMaxBytes(str: string, maxBytes: number) {
  const decoder = new TextDecoder('utf-8');
  const encoded = new TextEncoder().encode(str);

  return decoder.decode(encoded.slice(0, maxBytes)).replace(/\uFFFD/g, '');
}

function renderAddressItem({
  key,
  address,
  name,
  isHardware,
  deleteLabel,
  onClick,
  onDeleteClick,
}: {
  key: string;
  address: string;
  name?: string;
  isHardware?: boolean;
  deleteLabel?: string;
  onClick: (address: string) => void;
  onDeleteClick?: (address: string) => void;
}) {
  const isSavedAddress = !!onDeleteClick;
  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    onDeleteClick!(address);
  };

  return (
    <div
      key={key}
      tabIndex={-1}
      role="button"
      onMouseDown={IS_TOUCH_ENV ? undefined : () => onClick(address)}
      onClick={IS_TOUCH_ENV ? () => onClick(address) : undefined}
      className={styles.savedAddressItem}
    >
      <span className={styles.savedAddressName}>
        {name || shortenAddress(address)}
        {isHardware && <i className={buildClassName(styles.iconLedger, 'icon-ledger')} aria-hidden />}
      </span>
      {isSavedAddress && (
        <span className={styles.savedAddressDelete}>
          <span tabIndex={-1} role="button" className={styles.savedAddressDeleteInner} onMouseDown={handleDeleteClick}>
            {deleteLabel}
          </span>
        </span>
      )}
      {name && <span className={styles.savedAddressAddress}>{shortenAddress(address)}</span>}
      {isSavedAddress && (
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
      )}
    </div>
  );
}
