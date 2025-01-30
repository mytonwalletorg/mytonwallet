import type { TeactNode } from '../../lib/teact/teact';
import React, {
  memo, useEffect, useMemo, useRef, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiFetchEstimateDieselResult } from '../../api/chains/ton/types';
import type { ApiBaseCurrency, ApiChain, ApiNft } from '../../api/types';
import type { Account, SavedAddress, UserToken } from '../../global/types';
import type { ExplainedTransferFee } from '../../util/fee/transferFee';
import type { FeePrecision, FeeTerms } from '../../util/fee/types';
import type { DropdownItem } from '../ui/Dropdown';
import { TransferState } from '../../global/types';

import {
  CHAIN_CONFIG, IS_FIREFOX_EXTENSION, PRICELESS_TOKEN_HASHES, STAKED_TOKEN_SLUGS, TONCOIN,
} from '../../config';
import { Big } from '../../lib/big.js';
import renderText from '../../global/helpers/renderText';
import {
  selectCurrentAccountState,
  selectCurrentAccountTokens,
  selectIsHardwareAccount,
  selectIsMultichainAccount,
  selectNetworkAccounts,
} from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { vibrate } from '../../util/capacitor';
import { readClipboardContent } from '../../util/clipboard';
import { SECOND } from '../../util/dateFormat';
import { fromDecimal, toBig, toDecimal } from '../../util/decimals';
import dns from '../../util/dns';
import {
  explainApiTransferFee, getMaxTransferAmount, isBalanceSufficientForTransfer,
} from '../../util/fee/transferFee';
import { formatCurrency, getShortCurrencySymbol } from '../../util/formatNumber';
import { isValidAddressOrDomain } from '../../util/isValidAddressOrDomain';
import { debounce } from '../../util/schedulers';
import { shortenAddress } from '../../util/shortenAddress';
import stopEvent from '../../util/stopEvent';
import getChainNetworkIcon from '../../util/swap/getChainNetworkIcon';
import { IS_ANDROID, IS_FIREFOX, IS_TOUCH_ENV } from '../../util/windowEnvironment';
import { ASSET_LOGO_PATHS } from '../ui/helpers/assetLogos';

import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';
import useFlag from '../../hooks/useFlag';
import useInterval from '../../hooks/useInterval';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useQrScannerSupport from '../../hooks/useQrScannerSupport';
import useShowTransition from '../../hooks/useShowTransition';

import FeeDetailsModal from '../common/FeeDetailsModal';
import DeleteSavedAddressModal from '../main/modals/DeleteSavedAddressModal';
import Button from '../ui/Button';
import Dropdown from '../ui/Dropdown';
import FeeLine from '../ui/FeeLine';
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
}

interface StateProps {
  toAddress?: string;
  amount?: bigint;
  comment?: string;
  shouldEncrypt?: boolean;
  isLoading?: boolean;
  fee?: bigint;
  realFee?: bigint;
  tokenSlug: string;
  tokens?: UserToken[];
  savedAddresses?: SavedAddress[];
  currentAccountId?: string;
  accounts?: Record<string, Account>;
  isEncryptedCommentSupported: boolean;
  isMemoRequired?: boolean;
  baseCurrency?: ApiBaseCurrency;
  nfts?: ApiNft[];
  binPayload?: string;
  stateInit?: string;
  diesel?: ApiFetchEstimateDieselResult;
  isDieselAuthorizationStarted?: boolean;
  isMultichainAccount: boolean;
}

const SAVED_ADDRESS_OPEN_DELAY = 300;
const COMMENT_MAX_SIZE_BYTES = 5000;
const SHORT_ADDRESS_SHIFT = 11;
const MIN_ADDRESS_LENGTH_TO_SHORTEN = SHORT_ADDRESS_SHIFT * 2;
const COMMENT_DROPDOWN_ITEMS = [
  { value: 'raw', name: 'Comment or Memo' },
  { value: 'encrypted', name: 'Encrypted Message' },
];
const ACTIVE_STATES = new Set([TransferState.Initial, TransferState.None]);
const AUTHORIZE_DIESEL_INTERVAL_MS = SECOND;
const TRON_ADDRESS_REGEX = /^T[1-9A-HJ-NP-Za-km-z]{1,33}$/;

const INPUT_CLEAR_BUTTON_ID = 'input-clear-button';

const runDebounce = debounce((cb) => cb(), 500, false);

function doesSavedAddressFitSearch(savedAddress: SavedAddress, search: string) {
  const searchQuery = search.toLowerCase();
  const { address, name } = savedAddress;

  return (
    address.toLowerCase().startsWith(searchQuery)
    || address.toLowerCase().endsWith(searchQuery)
    || name.toLowerCase().split(/\s+/).some((part) => part.startsWith(searchQuery))
  );
}

function TransferInitial({
  isStatic,
  tokenSlug,
  toAddress = '',
  amount,
  comment = '',
  shouldEncrypt,
  tokens,
  fee,
  realFee,
  savedAddresses,
  accounts,
  currentAccountId,
  isEncryptedCommentSupported,
  isMemoRequired,
  isLoading,
  baseCurrency,
  nfts,
  binPayload,
  stateInit,
  diesel,
  isDieselAuthorizationStarted,
  isMultichainAccount,
}: OwnProps & StateProps) {
  const {
    submitTransferInitial,
    showNotification,
    fetchTransferFee,
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
    fetchTransferDieselState,
  } = getActions();

  const isNftTransfer = Boolean(nfts?.length);
  if (isNftTransfer) {
    // Token and amount can't be selected in the NFT transfer form, so they are overwritten once for convenience
    tokenSlug = TONCOIN.slug;
    amount = undefined;
  }

  // eslint-disable-next-line no-null/no-null
  const toAddressRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line no-null/no-null
  const addressBookTimeoutRef = useRef<number>(null);

  const lang = useLang();

  const transferToken = useMemo(() => tokens?.find((token) => token.slug === tokenSlug), [tokenSlug, tokens]);
  const {
    amount: balance,
    decimals,
    price,
    symbol,
    chain,
  } = transferToken || {};

  // Note: As of 27-11-2023, Firefox does not support readText()
  const [shouldRenderPasteButton, setShouldRenderPasteButton] = useState(!(IS_FIREFOX || IS_FIREFOX_EXTENSION));
  const [isAddressFocused, markAddressFocused, unmarkAddressFocused] = useFlag();
  const [isAddressBookOpen, openAddressBook, closeAddressBook] = useFlag();
  const [savedAddressForDeletion, setSavedAddressForDeletion] = useState<string | undefined>();
  const [savedChainForDeletion, setSavedChainForDeletion] = useState<ApiChain | undefined>();
  const toAddressShort = toAddress.length > MIN_ADDRESS_LENGTH_TO_SHORTEN
    ? shortenAddress(toAddress, SHORT_ADDRESS_SHIFT) || ''
    : toAddress;
  const isAddressValid = chain ? isValidAddressOrDomain(toAddress, chain) : undefined;
  const otherAccountIds = useMemo(() => {
    return accounts ? Object.keys(accounts).filter((accountId) => accountId !== currentAccountId) : [];
  }, [currentAccountId, accounts]);
  const shouldUseAddressBook = useMemo(() => {
    return otherAccountIds.length > 0 || (savedAddresses && savedAddresses.length > 0);
  }, [otherAccountIds.length, savedAddresses]);

  const nativeToken = useMemo(() => {
    return tokens?.find((token) => !token.tokenAddress && token.chain === chain);
  }, [tokens, chain])!;

  const isToncoin = tokenSlug === TONCOIN.slug;

  const shouldDisableClearButton = !toAddress && !(comment || binPayload) && !shouldEncrypt
    && !(isNftTransfer ? isStatic : amount !== undefined);

  const isQrScannerSupported = useQrScannerSupport();

  const amountInCurrency = price && amount
    ? toBig(amount, decimals).mul(price).round(decimals, Big.roundHalfUp).toString()
    : undefined;
  const renderingAmountInCurrency = useCurrentOrPrev(amountInCurrency, true);
  const withPasteButton = shouldRenderPasteButton && toAddress === '';
  const withAddressClearButton = !!toAddress.length;
  const shortBaseSymbol = getShortCurrencySymbol(baseCurrency);

  const explainedFee = useMemo(
    () => explainApiTransferFee({
      fee, realFee, diesel, tokenSlug,
    }),
    [fee, realFee, diesel, tokenSlug],
  );

  // Note: this constant has 3 distinct meaningful values
  const isEnoughBalance = isBalanceSufficientForTransfer({
    tokenBalance: balance,
    nativeTokenBalance: nativeToken.amount,
    transferAmount: isNftTransfer ? 0n : amount,
    fullFee: explainedFee.fullFee?.terms,
    canTransferFullBalance: explainedFee.canTransferFullBalance,
  });

  const isAmountMissing = !isNftTransfer && !amount;

  const isDisabledDebounce = useRef(false);

  const maxAmount = getMaxTransferAmount({
    tokenBalance: balance,
    tokenSlug,
    fullFee: explainedFee.fullFee?.terms,
    canTransferFullBalance: explainedFee.canTransferFullBalance,
  });

  const isDieselNotAuthorized = diesel?.status === 'not-authorized';
  const authorizeDieselInterval = isDieselNotAuthorized && isDieselAuthorizationStarted
    ? AUTHORIZE_DIESEL_INTERVAL_MS
    : undefined;

  const { shouldRender: shouldRenderCurrency, transitionClassNames: currencyClassNames } = useShowTransition(
    Boolean(amountInCurrency),
  );

  const updateDieselState = useLastCallback(() => {
    fetchTransferDieselState({ tokenSlug });
  });

  useInterval(updateDieselState, authorizeDieselInterval);

  const dropDownItems = useMemo(() => {
    if (!tokens) {
      return [];
    }

    return tokens.reduce<DropdownItem[]>((acc, token) => {
      if ((token.amount > 0 && !token.isDisabled) || token.slug === tokenSlug) {
        acc.push({
          value: token.slug,
          icon: ASSET_LOGO_PATHS[token.symbol.toLowerCase() as keyof typeof ASSET_LOGO_PATHS] || token.image,
          overlayIcon: isMultichainAccount ? getChainNetworkIcon(token.chain) : undefined,
          name: token.symbol,
        });
      }

      return acc;
    }, []);
  }, [isMultichainAccount, tokenSlug, tokens]);

  useEffect(() => {
    if (
      isToncoin
      && balance && amount && fee
      && amount < balance
      && fee < balance
      && amount + fee >= balance
    ) {
      setTransferAmount({ amount: balance - fee });
    }
  }, [isToncoin, amount, balance, fee]);

  // Note: this effect doesn't watch amount changes mainly because it's tricky to program a fee recalculation avoidance
  // when the amount changes due to a fee change. And it's not needed because the fee doesn't depend on the amount.
  useEffect(() => {
    if (isAmountMissing || !isAddressValid) {
      return;
    }

    const runFunction = () => {
      if (isNftTransfer) {
        fetchNftFee({
          toAddress,
          comment,
          nfts: nfts ?? [],
        });
      } else {
        fetchTransferFee({
          tokenSlug,
          toAddress,
          comment,
          shouldEncrypt,
          binPayload,
          stateInit,
        });
      }
    };

    if (!isDisabledDebounce.current) {
      runDebounce(runFunction);
    } else {
      isDisabledDebounce.current = false;
      runFunction();
    }
  }, [
    isAmountMissing, binPayload, comment, shouldEncrypt, isAddressValid, isNftTransfer, nfts, stateInit, toAddress,
    tokenSlug,
  ]);

  const handleTokenChange = useLastCallback((slug: string) => {
    changeTransferToken({ tokenSlug: slug });
    const token = tokens?.find((t) => t.slug === slug);
    if (STAKED_TOKEN_SLUGS.has(slug) || PRICELESS_TOKEN_HASHES.has(token?.codeHash!)) {
      showDialog({
        title: lang('Warning!'),
        message: lang('$service_token_transfer_warning'),
      });
    }
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
      parseAddressAndUpdateToken(toAddress.trim());
    }

    requestAnimationFrame(() => {
      handleAddressBookClose();
    });
  });

  const handleAddressInput = useLastCallback((newToAddress: string) => {
    setTransferToAddress({ toAddress: newToAddress });
    parseAddressAndUpdateToken(newToAddress);
  });

  const handleAddressClearClick = useLastCallback(() => {
    setTransferToAddress({ toAddress: undefined });
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
    }
  });

  function parseAddressAndUpdateToken(address: string) {
    if (!address || amount || !isMultichainAccount || !tokens) return;
    const chainFromAddress = getChainFromAddress(address);
    if (chainFromAddress === chain) return;

    const newTokenSlug = findTokenSlugWithMaxBalance(tokens, chainFromAddress)
      || CHAIN_CONFIG[chainFromAddress].nativeToken.slug;
    handleTokenChange(newTokenSlug);
  }

  const handlePasteClick = useLastCallback(async () => {
    try {
      const { type, text } = await readClipboardContent();

      if (type === 'text/plain') {
        isDisabledDebounce.current = true;
        setTransferToAddress({ toAddress: text.trim() });
        parseAddressAndUpdateToken(text.trim());
      }
    } catch (err: any) {
      showNotification({ message: lang('Error reading clipboard') });
      setShouldRenderPasteButton(false);
    }
  });

  const handleAddressBookItemClick = useLastCallback(
    (address: string) => {
      isDisabledDebounce.current = true;
      setTransferToAddress({ toAddress: address });
      parseAddressAndUpdateToken(address);
      closeAddressBook();
    },
  );

  const handleDeleteSavedAddressClick = useLastCallback(
    (address: string) => {
      setSavedAddressForDeletion(address);
      setSavedChainForDeletion(chain);
      closeAddressBook();
    },
  );

  const closeDeleteSavedAddressModal = useLastCallback(() => {
    setSavedAddressForDeletion(undefined);
    setSavedChainForDeletion(undefined);
  });

  const handleAmountChange = useLastCallback((stringValue?: string) => {
    const value = stringValue ? fromDecimal(stringValue, decimals) : undefined;
    if (value === undefined || value >= 0) {
      setTransferAmount({ amount: value });
    }
  });

  const handleMaxAmountClick = useLastCallback((e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();

    if (!balance) {
      return;
    }

    vibrate();
    isDisabledDebounce.current = true;
    setTransferAmount({ amount: maxAmount });
  });

  const handlePaste = useLastCallback(() => {
    isDisabledDebounce.current = true;
  });

  const handleCommentChange = useLastCallback((value) => {
    setTransferComment({ comment: trimStringByMaxBytes(value, COMMENT_MAX_SIZE_BYTES) });
  });

  const hasToAddressError = toAddress.length > 0 && !isAddressValid;
  const isAmountGreaterThanBalance = !isNftTransfer && balance !== undefined && amount !== undefined
    && amount > balance;
  const isInsufficientFee = isEnoughBalance === false && !isAmountGreaterThanBalance;
  const hasAmountError = !isNftTransfer && amount !== undefined && (
    (maxAmount !== undefined && amount > maxAmount)
    || isInsufficientFee // Ideally, the insufficient fee error message should be displayed somewhere else
  );
  const isCommentRequired = Boolean(toAddress) && isMemoRequired;
  const hasCommentError = isCommentRequired && !comment;

  const canSubmit = isDieselNotAuthorized || Boolean(
    isAddressValid && !isAmountMissing && !hasAmountError && isEnoughBalance && !hasCommentError
    && !(isNftTransfer && !nfts?.length),
  );

  const handleSubmit = useLastCallback((e) => {
    e.preventDefault();

    if (isDieselNotAuthorized) {
      authorizeDiesel();
      return;
    }

    if (!canSubmit) {
      return;
    }

    vibrate();

    submitTransferInitial({
      tokenSlug,
      amount: amount ?? 0n,
      toAddress,
      comment,
      binPayload,
      shouldEncrypt,
      nfts,
      withDiesel: explainedFee.isGasless,
      isGaslessWithStars: diesel?.status === 'stars-fee',
      stateInit,
    });
  });

  const handleCommentOptionsChange = useLastCallback((option: string) => {
    setTransferShouldEncrypt({ shouldEncrypt: option === 'encrypted' });
  });

  const [isFeeModalOpen, openFeeModal, closeFeeModal] = useFeeModal(explainedFee);

  const renderedSavedAddresses = useMemo(() => {
    if (!savedAddresses || savedAddresses.length === 0) {
      return undefined;
    }

    return savedAddresses
      .filter((item) => {
        // NFT transfer is only available on the TON blockchain
        return (!isNftTransfer || item.chain === 'ton') && doesSavedAddressFitSearch(item, toAddress);
      })
      .map((item) => renderAddressItem({
        key: `saved-${item.address}-${item.chain}`,
        address: item.address,
        name: item.name,
        chain: isMultichainAccount ? item.chain : undefined,
        deleteLabel: lang('Delete'),
        onClick: handleAddressBookItemClick,
        onDeleteClick: handleDeleteSavedAddressClick,
      }));
  }, [savedAddresses, isNftTransfer, toAddress, isMultichainAccount, lang]);

  const renderedOtherAccounts = useMemo(() => {
    if (otherAccountIds.length === 0) return undefined;

    const addressesToBeIgnored = savedAddresses?.map((item) => `${item.chain}:${item.address}`) ?? [];
    const uniqueAddresses = new Set<string>();
    const otherAccounts = otherAccountIds
      .reduce((acc, accountId) => {
        const account = accounts![accountId];

        Object.keys(account.addressByChain).forEach((currentChain) => {
          const currentAddress = account.addressByChain[currentChain as ApiChain];
          const key = `${currentChain}:${currentAddress}`;
          if (
            !uniqueAddresses.has(key)
            // NFT transfer is only available on the TON blockchain
            && (!isNftTransfer || currentChain === 'ton')
            && (isMultichainAccount || currentChain === TONCOIN.chain)
            && !addressesToBeIgnored.includes(`${currentChain}:${currentAddress}`)
          ) {
            uniqueAddresses.add(key);
            acc.push({
              name: account.title || shortenAddress(currentAddress)!,
              address: currentAddress,
              chain: currentChain as ApiChain,
              isHardware: account.isHardware,
            });
          }
        });

        return acc;
      }, [] as (SavedAddress & { isHardware?: boolean })[]);

    return otherAccounts.filter(
      (item) => doesSavedAddressFitSearch(item, toAddress),
    ).map(({
      address, name, chain: addressChain, isHardware,
    }) => renderAddressItem({
      key: `address-${address}-${addressChain}`,
      address,
      name,
      chain: isMultichainAccount ? addressChain : undefined,
      isHardware,
      onClick: handleAddressBookItemClick,
    }));
  }, [otherAccountIds, savedAddresses, accounts, isMultichainAccount, isNftTransfer, toAddress]);

  const shouldRenderSuggestions = !!renderedSavedAddresses?.length || !!renderedOtherAccounts?.length;

  function renderAddressBook() {
    if (!shouldRenderSuggestions) return undefined;

    return (
      <Menu
        positionX="right"
        type="suggestion"
        noBackdrop
        bubbleClassName={styles.savedAddressBubble}
        isOpen={isAddressBookOpen}
        onClose={closeAddressBook}
      >
        {renderedSavedAddresses}
        {renderedOtherAccounts}
      </Menu>
    );
  }

  function renderBottomRight() {
    let transitionKey = 0;
    let content: TeactNode = ' ';

    if (amount) {
      if (isAmountGreaterThanBalance) {
        transitionKey = 1;
        content = <span className={styles.balanceError}>{lang('Insufficient balance')}</span>;
      } else if (isInsufficientFee) {
        transitionKey = 2;
        content = <span className={styles.balanceError}>{lang('Insufficient fee')}</span>;
      }
    }

    return (
      <Transition
        className={buildClassName(styles.amountBottomRight, isStatic && styles.amountBottomRight_static)}
        slideClassName={styles.amountBottomRight_slide}
        name="fade"
        activeKey={transitionKey}
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
    if (!symbol || isNftTransfer) {
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
                {maxAmount !== undefined ? formatCurrency(toDecimal(maxAmount, decimals), symbol) : lang('Loading...')}
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
        itemClassName={styles.tokenDropdownItem}
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
        disabled={chain === 'tron'}
        menuPositionHorizontal="left"
        shouldTranslateOptions
        className={styles.commentLabel}
        onChange={handleCommentOptionsChange}
      />
    );
  }

  function renderCommentField() {
    if (binPayload || stateInit) {
      return (
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
      );
    }

    return (
      <Input
        wrapperClassName={styles.commentInputWrapper}
        className={isStatic ? styles.inputStatic : undefined}
        label={renderCommentLabel()}
        placeholder={isCommentRequired ? lang('Required') : lang('Optional')}
        value={comment}
        isControlled
        isMultiline
        isDisabled={chain === 'tron'}
        onInput={handleCommentChange}
        isRequired={isCommentRequired}
      />
    );
  }

  const withButton = isQrScannerSupported || withPasteButton || withAddressClearButton;

  function renderButtonText() {
    if (diesel?.status === 'not-authorized') {
      return lang('Authorize %token% Fee', { token: symbol! });
    }
    if (diesel?.status === 'pending-previous' && isInsufficientFee) {
      return lang('Awaiting Previous Fee');
    }
    return lang('$send_token_symbol', isNftTransfer ? 'NFT' : symbol || 'TON');
  }

  const shouldIgnoreErrors = isAddressBookOpen && shouldRenderSuggestions;

  function renderFee() {
    let terms: FeeTerms | undefined;
    let precision: FeePrecision = 'exact';

    if (!isAmountMissing) {
      const actualFee = isInsufficientFee ? explainedFee.fullFee : explainedFee.realFee;
      if (actualFee) {
        ({ terms, precision } = actualFee);
      }
    }

    return (
      <FeeLine
        isStatic={isStatic}
        terms={terms}
        token={transferToken}
        precision={precision}
        onDetailsClick={openFeeModal}
      />
    );
  }

  return (
    <>
      <form
        className={isStatic ? undefined : modalStyles.transitionContent}
        onSubmit={handleSubmit}
        onPaste={handlePaste}
      >
        {nfts?.length === 1 && <NftInfo nft={nfts[0]} isStatic={isStatic} />}
        {Boolean(nfts?.length) && nfts!.length > 1 && <NftChips nfts={nfts!} isStatic={isStatic} />}

        <Input
          ref={toAddressRef}
          className={buildClassName(isStatic && styles.inputStatic, withButton && styles.inputWithIcon)}
          isRequired
          label={lang('Recipient Address')}
          placeholder={lang('Wallet address or domain')}
          value={isAddressFocused ? toAddress : toAddressShort}
          error={hasToAddressError && !shouldIgnoreErrors ? (lang('Incorrect address') as string) : undefined}
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

        {chain === 'ton' && renderCommentField()}

        <div className={buildClassName(styles.footer, isStatic && chain !== 'ton' && styles.footer_shifted)}>
          {renderFee()}

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
        </div>
      </form>
      <DeleteSavedAddressModal
        isOpen={Boolean(savedAddressForDeletion)}
        address={savedAddressForDeletion}
        chain={savedChainForDeletion}
        onClose={closeDeleteSavedAddressModal}
      />
      <FeeDetailsModal
        isOpen={isFeeModalOpen}
        onClose={closeFeeModal}
        fullFee={explainedFee.fullFee?.terms}
        realFee={explainedFee.realFee?.terms}
        realFeePrecision={explainedFee.realFee?.precision}
        excessFee={explainedFee.excessFee}
        excessFeePrecision="approximate"
        token={transferToken}
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
        realFee,
        tokenSlug,
        isLoading,
        state,
        nfts,
        binPayload,
        isMemoRequired,
        diesel,
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
        realFee,
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
        diesel,
        isDieselAuthorizationStarted: accountState?.isDieselAuthorizationStarted,
        isMultichainAccount: selectIsMultichainAccount(global, global.currentAccountId!),
      };
    },
    (global, { isStatic }, stickToFirst) => {
      if (!isStatic) {
        return stickToFirst(global.currentAccountId);
      }

      const { nfts, tokenSlug = TONCOIN.slug } = global.currentTransfer;
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
  chain,
  isHardware,
  deleteLabel,
  onClick,
  onDeleteClick,
}: {
  key: string;
  address: string;
  name?: string;
  chain?: ApiChain;
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
        <span className={styles.savedAddressNameText}>
          {name || shortenAddress(address)}
        </span>
        {isHardware && <i className={buildClassName(styles.iconLedger, 'icon-ledger')} aria-hidden />}
      </span>
      {isSavedAddress && (
        <span className={styles.savedAddressDelete}>
          <span tabIndex={-1} role="button" className={styles.savedAddressDeleteInner} onMouseDown={handleDeleteClick}>
            {deleteLabel}
          </span>
        </span>
      )}
      {name && (
        <span className={styles.savedAddressAddress}>
          {chain && <i className={buildClassName(styles.chainIcon, `icon-chain-${chain}`)} aria-hidden />}
          {shortenAddress(address)}
        </span>
      )}
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

function findTokenSlugWithMaxBalance(tokens: UserToken[], chain: ApiChain) {
  const resultToken = tokens
    .filter((token) => token.chain === chain)
    .reduce((maxToken, currentToken) => {
      const currentBalance = currentToken.priceUsd * Number(currentToken.amount);
      const maxBalance = maxToken ? maxToken.priceUsd * Number(maxToken.amount) : 0;

      return currentBalance > maxBalance ? currentToken : maxToken;
    });

  return resultToken?.slug;
}

function getIsTronAddress(address: string) {
  return TRON_ADDRESS_REGEX.test(address);
}

function getChainFromAddress(address: string): ApiChain {
  if (getIsTronAddress(address)) {
    return 'tron';
  }

  return 'ton';
}

function useFeeModal(explainedFee: ExplainedTransferFee) {
  const isAvailable = explainedFee.realFee?.precision !== 'exact';
  const [isOpen, open, close] = useFlag(false);
  const openIfAvailable = isAvailable ? open : undefined;
  return [isOpen, openIfAvailable, close] as const;
}
