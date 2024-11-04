import type { TeactNode } from '../../lib/teact/teact';
import React, {
  memo, useEffect, useMemo, useRef, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiBaseCurrency, ApiChain, ApiNft } from '../../api/types';
import type {
  Account, DieselStatus, SavedAddress, UserToken,
} from '../../global/types';
import type { DropdownItem } from '../ui/Dropdown';
import { TransferState } from '../../global/types';

import {
  IS_FIREFOX_EXTENSION, STARS_SYMBOL, TONCOIN, TRX,
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
import { fromDecimal, toBig, toDecimal } from '../../util/decimals';
import dns from '../../util/dns';
import { formatCurrency, formatCurrencyExtended, getShortCurrencySymbol } from '../../util/formatNumber';
import { isValidAddressOrDomain } from '../../util/isValidAddressOrDomain';
import { debounce } from '../../util/schedulers';
import { shortenAddress } from '../../util/shortenAddress';
import stopEvent from '../../util/stopEvent';
import getChainNetworkIcon from '../../util/swap/getChainNetworkIcon';
import { getIsNativeToken } from '../../util/tokens';
import { IS_ANDROID, IS_FIREFOX, IS_TOUCH_ENV } from '../../util/windowEnvironment';
import { NFT_TRANSFER_AMOUNT } from '../../api/chains/ton/constants';
import { ONE_TRX } from '../../api/chains/tron/constants';
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
  savedAddresses?: SavedAddress[];
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
const STAKED_TOKEN_SLUG = 'ton-eqcqc6ehrj';
const AUTHORIZE_DIESEL_INTERVAL_MS = 1000;
const TRON_ADDRESS_REGEX = /^T[1-9A-HJ-NP-Za-km-z]{1,33}$/;

const INPUT_CLEAR_BUTTON_ID = 'input-clear-button';

const runDebounce = debounce((cb) => cb(), 500, true);

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
  tokenSlug = TONCOIN.slug,
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
  baseCurrency,
  nfts,
  binPayload,
  stateInit,
  dieselAmount,
  dieselStatus,
  isDieselAuthorizationStarted,
  isMultichainAccount,
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

  const {
    amount: balance,
    decimals,
    price,
    symbol,
    chain,
  } = useMemo(() => tokens?.find((token) => token.slug === tokenSlug), [tokenSlug, tokens]) || {};

  // Note: As of 27-11-2023, Firefox does not support readText()
  const [shouldRenderPasteButton, setShouldRenderPasteButton] = useState(!(IS_FIREFOX || IS_FIREFOX_EXTENSION));
  const [isAddressFocused, markAddressFocused, unmarkAddressFocused] = useFlag();
  const [isAddressBookOpen, openAddressBook, closeAddressBook] = useFlag();
  const [savedAddressForDeletion, setSavedAddressForDeletion] = useState<string | undefined>();
  const [savedChainForDeletion, setSavedChainForDeletion] = useState<ApiChain | undefined>();
  const [hasToAddressError, setHasToAddressError] = useState<boolean>(false);
  const [hasAmountError, setHasAmountError] = useState<boolean>(false);
  const [isInsufficientBalance, setIsInsufficientBalance] = useState<boolean>(false);
  const [isInsufficientFee, setIsInsufficientFee] = useState(false);
  const isNftTransfer = Boolean(nfts?.length);
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

  const isNativeCoin = getIsNativeToken(tokenSlug);
  const nativeToken = useMemo(() => {
    return tokens?.find((token) => !token.tokenAddress && token.chain === chain);
  }, [tokens, chain])!;

  const isUpdatingAmountDueToMaxChange = useRef(false);
  const [isMaxAmountSelected, setMaxAmountSelected] = useState(false);
  const [prevDieselAmount, setPrevDieselAmount] = useState(dieselAmount);

  const isToncoin = tokenSlug === TONCOIN.slug;
  const toncoinToken = useMemo(() => tokens?.find((token) => token.slug === TONCOIN.slug), [tokens])!;
  const isToncoinFullBalance = isToncoin && balance === amount;

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

  const additionalAmount = amount && isToncoin ? amount : 0n;
  const isEnoughNativeCoin = isToncoinFullBalance
    ? (fee !== undefined && fee < toncoinToken.amount)
    : (fee !== undefined && (fee + additionalAmount) <= nativeToken.amount);

  const isGaslessWithStars = dieselStatus === 'stars-fee';
  const isDieselAvailable = dieselStatus === 'available' || isGaslessWithStars;
  const isDieselNotAuthorized = dieselStatus === 'not-authorized';
  const withDiesel = dieselStatus && dieselStatus !== 'not-available';
  const isEnoughDiesel = withDiesel && amount && balance && dieselAmount
    ? isGaslessWithStars || isUpdatingAmountDueToMaxChange.current
      ? true
      : balance - amount >= dieselAmount
    : undefined;

  const feeSymbol = isGaslessWithStars ? STARS_SYMBOL : symbol;
  const isDisabledDebounce = useRef(false);

  const maxAmount = useMemo(() => {
    if (withDiesel && dieselAmount && balance) {
      return isGaslessWithStars
        ? balance
        : balance - dieselAmount;
    }
    if (nativeToken?.chain === 'tron' && balance) {
      return balance - ONE_TRX;
    }
    return balance;
  }, [balance, dieselAmount, isGaslessWithStars, withDiesel, nativeToken]);

  const authorizeDieselInterval = isDieselNotAuthorized && isDieselAuthorizationStarted && tokenSlug && !isToncoin
    ? AUTHORIZE_DIESEL_INTERVAL_MS
    : undefined;

  const { shouldRender: shouldRenderCurrency, transitionClassNames: currencyClassNames } = useShowTransition(
    Boolean(amountInCurrency),
  );

  const updateDieselState = useLastCallback(() => {
    fetchDieselState({ tokenSlug });
  });

  const validateToAddress = useLastCallback(() => {
    setHasToAddressError(Boolean(toAddress) && !isAddressValid);
  });

  useInterval(updateDieselState, authorizeDieselInterval);

  useEffect(() => {
    validateToAddress();
  }, [isAddressValid]);

  const dropDownItems = useMemo(() => {
    if (!tokens) {
      return [];
    }

    return tokens.reduce<DropdownItem[]>((acc, token) => {
      if (token.amount > 0 || token.slug === tokenSlug) {
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

      const nativeBalance = nativeToken.amount;
      const nativeAmount = isNativeCoin ? newAmount : 0n;

      if (!balance || newAmount > balance) {
        setHasAmountError(true);
        setIsInsufficientBalance(true);
      } else if (isToncoin && nativeAmount === toncoinToken.amount) {
        // Do nothing
      } else if (
        fee !== undefined
        && (fee >= nativeBalance || (fee + nativeAmount > nativeBalance))
        && !isDieselAvailable
      ) {
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
    if (isMaxAmountSelected && dieselAmount && prevDieselAmount !== dieselAmount && maxAmount! > 0) {
      isUpdatingAmountDueToMaxChange.current = true;

      setMaxAmountSelected(false);
      setPrevDieselAmount(dieselAmount);
      setTransferAmount({ amount: maxAmount });
    }
  }, [
    dieselAmount, maxAmount, isMaxAmountSelected, prevDieselAmount, withDiesel, balance, isGaslessWithStars,
  ]);

  useEffect(() => {
    if (
      !toAddress
      || hasToAddressError
      || !(amount || nfts?.length)
      || !isAddressValid
      || isUpdatingAmountDueToMaxChange.current
    ) {
      isUpdatingAmountDueToMaxChange.current = false;
      return;
    }

    const runFunction = () => {
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
    };

    if (!isDisabledDebounce.current) {
      runDebounce(runFunction);
    } else {
      isDisabledDebounce.current = false;
      runFunction();
    }
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
      if (slug === tokenSlug) return;

      changeTransferToken({ tokenSlug: slug });
      setMaxAmountSelected(false);
      if (slug === STAKED_TOKEN_SLUG) {
        showDialog({
          title: lang('Warning!'),
          // eslint-disable-next-line max-len
          message: lang('You are about to transfer an important service token, which is needed to withdraw your deposit from staking.'),
        });
      }
    },
  );

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
      validateToAddress();
      handleAddressBookClose();
    });
  });

  const handleAddressInput = useLastCallback((newToAddress: string) => {
    setTransferToAddress({ toAddress: newToAddress });
    parseAddressAndUpdateToken(newToAddress);
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

  function parseAddressAndUpdateToken(address: string) {
    if (!address || amount || !isMultichainAccount || !tokens) return;

    if (isTronAddress(address)) {
      if (chain === 'tron') return;

      const newTokenSlug = findTokenSlugWithMaxBalance(tokens, 'tron') || TRX.slug;
      handleTokenChange(newTokenSlug);
      return;
    }

    const newTokenSlug = findTokenSlugWithMaxBalance(tokens, 'ton') || TONCOIN.slug;
    handleTokenChange(newTokenSlug);
  }

  const handlePasteClick = useLastCallback(async () => {
    try {
      const { type, text } = await readClipboardContent();

      if (type === 'text/plain') {
        setTransferToAddress({ toAddress: text.trim() });
        parseAddressAndUpdateToken(text.trim());
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
    validateAndSetAmount(value);
  });

  const handleMaxAmountClick = useLastCallback((e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();

    if (!balance) {
      return;
    }

    vibrate();
    if (maxAmount! > 0) {
      isDisabledDebounce.current = true;
      setMaxAmountSelected(true);
      setTransferAmount({ amount: maxAmount });
    }
  });

  const handlePaste = useLastCallback(() => {
    isDisabledDebounce.current = true;
  });

  const handleCommentChange = useLastCallback((value) => {
    setTransferComment({ comment: trimStringByMaxBytes(value, COMMENT_MAX_SIZE_BYTES) });
  });

  const isCommentRequired = Boolean(toAddress) && isMemoRequired;
  const hasCommentError = isCommentRequired && !comment;
  const requiredAmount = isNftTransfer ? NFT_TRANSFER_AMOUNT : amount;

  const canSubmit = Boolean(toAddress.length && requiredAmount && balance && requiredAmount > 0
    && requiredAmount <= balance && !hasToAddressError && !hasAmountError
    && (isEnoughNativeCoin || isEnoughDiesel || isDieselNotAuthorized) && !hasCommentError
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
      binPayload,
      shouldEncrypt,
      nftAddresses: isNftTransfer ? nfts!.map(({ address }) => address) : undefined,
      withDiesel,
      isGaslessWithStars,
      stateInit,
    });
  });

  const handleCommentOptionsChange = useLastCallback((option: string) => {
    setTransferShouldEncrypt({ shouldEncrypt: option === 'encrypted' });
  });

  const renderedSavedAddresses = useMemo(() => {
    if (!savedAddresses || savedAddresses.length === 0) {
      return undefined;
    }

    return savedAddresses.filter(
      (item) => doesSavedAddressFitSearch(item, toAddress),
    ).map((item) => renderAddressItem({
      key: `saved-${item.address}-${item.chain}`,
      address: item.address,
      name: item.name,
      chain: isMultichainAccount ? item.chain : undefined,
      deleteLabel: lang('Delete'),
      onClick: handleAddressBookItemClick,
      onDeleteClick: handleDeleteSavedAddressClick,
    }));
  }, [savedAddresses, isMultichainAccount, lang, toAddress]);

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
  }, [otherAccountIds, savedAddresses, accounts, isMultichainAccount, toAddress]);

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
    const withFee = fee !== undefined && amount && amount > 0;

    const activeKey = isInsufficientBalance ? 0
      : isInsufficientFee ? 1
        : withFee ? 2
          : 3;

    const insufficientBalanceText = <span className={styles.balanceError}>{lang('Insufficient balance')}</span>;
    const insufficientFeeText = withFee ? (
      <span className={styles.balanceError}>
        {lang('$insufficient_fee', {
          fee: formatCurrencyExtended(toDecimal(renderingFee!, nativeToken.decimals), nativeToken.symbol, true),
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

    if (withDiesel && dieselAmount && feeSymbol) {
      feeText = lang('$fee_value', {
        fee: (
          <span className={styles.feeValue}>
            {formatCurrencyExtended(toDecimal(dieselAmount!, decimals), feeSymbol, true, decimals)}
          </span>
        ),
      });
    } else if (withFee) {
      feeText = lang('$fee_value', {
        fee: (
          <span className={styles.feeValue}>
            {formatCurrencyExtended(
              toDecimal(renderingFee!, nativeToken.decimals), nativeToken.symbol, true, nativeToken.decimals,
            )}
          </span>
        ),
      });
    }

    const content = isInsufficientBalance
      ? insufficientBalanceText
      : withDiesel && !isEnoughDiesel
        ? insufficientDieselText
        : isInsufficientFee
          ? insufficientFeeText
          : withFee
            ? feeText
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
        itemNameClassName={styles.tokenDropdownItem}
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
    if (!isEnoughNativeCoin && withDiesel && !isDieselAvailable) {
      if (dieselStatus === 'pending-previous') {
        return lang('Awaiting Previous Fee');
      } else {
        return lang('Authorize %token% Fee', { token: symbol! });
      }
    } else {
      return lang('$send_token_symbol', isNftTransfer ? 'NFT' : symbol || 'TON');
    }
  }

  const shouldIgnoreErrors = isAddressBookOpen && shouldRenderSuggestions;

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

        <div className={buildClassName(styles.buttons, isStatic && chain !== 'ton' && styles.buttonsShifted)}>
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
        chain={savedChainForDeletion}
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

function isTronAddress(address: string) {
  return TRON_ADDRESS_REGEX.test(address);
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
