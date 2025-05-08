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
import { TransferState } from '../../global/types';

import { PRICELESS_TOKEN_HASHES, STAKED_TOKEN_SLUGS, TONCOIN } from '../../config';
import { Big } from '../../lib/big.js';
import {
  selectCurrentAccountState,
  selectCurrentAccountTokenBalance,
  selectCurrentAccountTokens,
  selectIsHardwareAccount,
  selectIsMultichainAccount,
  selectNetworkAccounts,
} from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { readClipboardContent } from '../../util/clipboard';
import { SECOND } from '../../util/dateFormat';
import { fromDecimal, toBig } from '../../util/decimals';
import { isDnsDomain } from '../../util/dns';
import { stopEvent } from '../../util/domEvents';
import {
  explainApiTransferFee, getMaxTransferAmount, isBalanceSufficientForTransfer,
} from '../../util/fee/transferFee';
import { formatCurrency, getShortCurrencySymbol } from '../../util/formatNumber';
import { getLocalAddressName } from '../../util/getLocalAddressName';
import { vibrate } from '../../util/haptics';
import { isValidAddressOrDomain } from '../../util/isValidAddressOrDomain';
import { debounce } from '../../util/schedulers';
import { trimStringByMaxBytes } from '../../util/text';
import { getChainBySlug, getNativeToken } from '../../util/tokens';
import { getIsMobileTelegramApp, IS_ANDROID, IS_CLIPBOARDS_SUPPORTED, IS_IOS } from '../../util/windowEnvironment';

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
import FeeLine from '../ui/FeeLine';
import Transition from '../ui/Transition';
import AddressBook from './AddressBook';
import AddressInput, { INPUT_CLEAR_BUTTON_ID } from './AddressInput';
import AmountInputSection from './AmountInputSection';
import CommentSection from './CommentSection';
import NftChips from './NftChips';
import NftInfo from './NftInfo';

import modalStyles from '../ui/Modal.module.scss';
import styles from './Transfer.module.scss';

interface OwnProps {
  isStatic?: boolean;
}

interface StateProps {
  toAddress?: string;
  resolvedAddress?: string;
  toAddressName?: string;
  amount?: bigint;
  comment?: string;
  shouldEncrypt?: boolean;
  isLoading?: boolean;
  fee?: bigint;
  realFee?: bigint;
  tokenSlug: string;
  tokens?: UserToken[];
  savedAddresses?: SavedAddress[];
  currentAccountId: string;
  accounts?: Record<string, Account>;
  nativeTokenBalance: bigint;
  isEncryptedCommentSupported: boolean;
  isMemoRequired?: boolean;
  baseCurrency?: ApiBaseCurrency;
  nfts?: ApiNft[];
  binPayload?: string;
  stateInit?: string;
  diesel?: ApiFetchEstimateDieselResult;
  isDieselAuthorizationStarted?: boolean;
  isMultichainAccount: boolean;
  isSensitiveDataHidden?: true;
}

const SAVED_ADDRESS_OPEN_DELAY = 300;
const COMMENT_MAX_SIZE_BYTES = 5000;
const ACTIVE_STATES = new Set([TransferState.Initial, TransferState.None]);
const AUTHORIZE_DIESEL_INTERVAL_MS = SECOND;

const runDebounce = debounce((cb) => cb(), 500, false);

function TransferInitial({
  isStatic,
  tokenSlug,
  toAddress = '',
  resolvedAddress,
  toAddressName = '',
  amount,
  comment = '',
  shouldEncrypt,
  tokens,
  fee,
  realFee,
  savedAddresses,
  accounts,
  nativeTokenBalance,
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
  isSensitiveDataHidden,
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
    checkTransferAddress,
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
    codeHash,
    type: tokenType,
  } = transferToken || {};

  const [shouldRenderPasteButton, setShouldRenderPasteButton] = useState(IS_CLIPBOARDS_SUPPORTED);
  const [isAddressFocused, markAddressFocused, unmarkAddressFocused] = useFlag();
  const [isAddressBookOpen, openAddressBook, closeAddressBook] = useFlag();
  const [savedAddressForDeletion, setSavedAddressForDeletion] = useState<string | undefined>();
  const [savedChainForDeletion, setSavedChainForDeletion] = useState<ApiChain | undefined>();

  const isAddressValid = chain ? isValidAddressOrDomain(toAddress, chain) : undefined;
  const otherAccountIds = useMemo(() => {
    return accounts ? Object.keys(accounts).filter((accountId) => accountId !== currentAccountId) : [];
  }, [currentAccountId, accounts]);
  const shouldUseAddressBook = useMemo(() => {
    return otherAccountIds.length > 0 || (savedAddresses && savedAddresses.length > 0);
  }, [otherAccountIds.length, savedAddresses]);

  const isToncoin = tokenSlug === TONCOIN.slug;

  const shouldDisableClearButton = !toAddress && !(comment || binPayload) && !shouldEncrypt
    && !(isNftTransfer ? isStatic : amount !== undefined);

  const isQrScannerSupported = useQrScannerSupport();

  const amountInCurrency = price && amount
    ? toBig(amount, decimals).mul(price).round(decimals, Big.roundHalfUp).toString()
    : undefined;
  const renderingAmountInCurrency = useCurrentOrPrev(amountInCurrency, true);
  const withPasteButton = shouldRenderPasteButton && toAddress === '';
  const shortBaseSymbol = getShortCurrencySymbol(baseCurrency);

  const localAddressName = useMemo(() => getLocalAddressName({
    address: toAddress,
    chain: getChainBySlug(tokenSlug),
    currentAccountId,
    savedAddresses,
    accounts: accounts!,
  }), [accounts, currentAccountId, savedAddresses, toAddress, tokenSlug]);

  const explainedFee = useMemo(
    () => explainApiTransferFee({
      fee, realFee, diesel, tokenSlug,
    }),
    [fee, realFee, diesel, tokenSlug],
  );

  // Note: this constant has 3 distinct meaningful values
  const isEnoughBalance = isBalanceSufficientForTransfer({
    tokenBalance: balance,
    nativeTokenBalance,
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
  const renderedCurrencyValue = useMemo(() => {
    return (
      <span className={buildClassName(styles.amountInCurrency, currencyClassNames)}>
        ≈&thinsp;{formatCurrency(renderingAmountInCurrency || '0', shortBaseSymbol, undefined, true)}
      </span>);
  }, [currencyClassNames, renderingAmountInCurrency, shortBaseSymbol]);

  const updateDieselState = useLastCallback(() => {
    fetchTransferDieselState({ tokenSlug });
  });

  useInterval(updateDieselState, authorizeDieselInterval);

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

  useEffect(() => {
    if (tokenType === 'lp_token' || STAKED_TOKEN_SLUGS.has(tokenSlug) || PRICELESS_TOKEN_HASHES.has(codeHash ?? '')) {
      showDialog({
        title: lang('Warning!'),
        message: lang('$service_token_transfer_warning'),
        noBackdropClose: true,
      });
    }
  }, [tokenType, tokenSlug, codeHash, lang]);

  const handleTokenChange = useLastCallback((slug: string) => {
    changeTransferToken({ tokenSlug: slug });
  });

  const handleAddressBookClose = useLastCallback(() => {
    if (!shouldUseAddressBook || !isAddressBookOpen) return;

    closeAddressBook();

    if (addressBookTimeoutRef.current) {
      window.clearTimeout(addressBookTimeoutRef.current);
    }
  });

  const handleAddressFocus = useLastCallback(() => {
    markAddressFocused();

    if (shouldUseAddressBook) {
      // Simultaneous opening of the virtual keyboard and display of Saved Addresses causes animation degradation
      if (IS_ANDROID) {
        addressBookTimeoutRef.current = window.setTimeout(openAddressBook, SAVED_ADDRESS_OPEN_DELAY);
      } else {
        openAddressBook();
      }
    }
  });

  const handleAddressCheck = useLastCallback((address?: string) => {
    if ((address && chain && isValidAddressOrDomain(address, chain)) || !address) {
      checkTransferAddress({ address });
    }
  });

  const handleAddressBlur = useLastCallback((e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    unmarkAddressFocused();

    if (e.relatedTarget?.id === INPUT_CLEAR_BUTTON_ID) {
      handleAddressBookClose();
      handleAddressCheck(toAddress);

      return;
    }

    let addressToCheck = toAddress;
    if (isDnsDomain(toAddress) && toAddress !== toAddress.toLowerCase()) {
      addressToCheck = toAddress.toLowerCase().trim();
      setTransferToAddress({ toAddress: addressToCheck });
    } else if (toAddress !== toAddress.trim()) {
      addressToCheck = toAddress.trim();
      setTransferToAddress({ toAddress: addressToCheck });
    }

    requestAnimationFrame(() => {
      handleAddressBookClose();
      handleAddressCheck(addressToCheck);
    });
  });

  const handleAddressInput = useLastCallback((newToAddress: string) => {
    setTransferToAddress({ toAddress: newToAddress });
  });

  const handleAddressClearClick = useLastCallback(() => {
    setTransferToAddress({ toAddress: undefined });
    handleAddressCheck();
  });

  const handleQrScanClick = useLastCallback(() => {
    if (IS_IOS && getIsMobileTelegramApp()) {
      // eslint-disable-next-line no-alert
      alert('Scanning is temporarily not available');
      return;
    }

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

  const handlePasteClick = useLastCallback(async () => {
    try {
      const { type, text } = await readClipboardContent();

      if (type === 'text/plain') {
        isDisabledDebounce.current = true;
        const newToAddress = text.trim();
        setTransferToAddress({ toAddress: newToAddress });

        handleAddressCheck(newToAddress);
      }
    } catch (err: any) {
      showNotification({ message: lang('Error reading clipboard') });
      setShouldRenderPasteButton(false);
    }
  });

  const handleAddressBookItemSelect = useLastCallback(
    (address: string) => {
      isDisabledDebounce.current = true;
      setTransferToAddress({ toAddress: address });
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

  const handleMaxAmountClick = useLastCallback(() => {
    if (!balance) {
      return;
    }

    void vibrate();
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
  const hasInsufficientFeeError = isEnoughBalance === false && !isAmountGreaterThanBalance
    && diesel?.status !== 'not-authorized' && diesel?.status !== 'pending-previous';
  const hasAmountError = !isNftTransfer && amount !== undefined && (
    (maxAmount !== undefined && amount > maxAmount)
    || hasInsufficientFeeError // Ideally, the insufficient fee error message should be displayed somewhere else
  );
  const isCommentRequired = Boolean(toAddress) && isMemoRequired;
  const hasCommentError = isCommentRequired && !comment;

  const canSubmit = isDieselNotAuthorized || Boolean(
    isAddressValid
    && !isAmountMissing && !hasAmountError
    && isEnoughBalance
    && !hasCommentError
    && (!explainedFee.isGasless || diesel?.status === 'available' || diesel?.status === 'stars-fee')
    && !(isNftTransfer && !nfts?.length),
  );

  const handleSubmit = useLastCallback((e: React.FormEvent | React.UIEvent) => {
    stopEvent(e);

    if (isDieselNotAuthorized) {
      authorizeDiesel();
      return;
    }

    if (!canSubmit) {
      return;
    }

    void vibrate();

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

  const [isFeeModalOpen, openFeeModal, closeFeeModal] = useFeeModal(explainedFee);

  const renderedBottomRight = useMemo(() => {
    let transitionKey = 0;
    let content: TeactNode = ' ';

    if (amount) {
      if (isAmountGreaterThanBalance) {
        transitionKey = 1;
        content = <span className={styles.balanceError}>{lang('Insufficient balance')}</span>;
      } else if (hasInsufficientFeeError) {
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
  }, [amount, hasInsufficientFeeError, isAmountGreaterThanBalance, isStatic, lang]);

  function renderButtonText() {
    if (diesel?.status === 'not-authorized') {
      return lang('Authorize %token% Fee', { token: symbol! });
    }
    if (diesel?.status === 'pending-previous') {
      return lang('Awaiting Previous Fee');
    }
    return lang('$send_token_symbol', isNftTransfer ? 'NFT' : symbol || 'TON');
  }

  function renderFee() {
    let terms: FeeTerms | undefined;
    let precision: FeePrecision = 'exact';

    if (!isAmountMissing) {
      const actualFee = hasInsufficientFeeError ? explainedFee.fullFee : explainedFee.realFee;
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
        {nfts?.length === 1 && <NftInfo nft={nfts[0]} isStatic={isStatic} withMediaViewer />}
        {Boolean(nfts?.length) && nfts!.length > 1 && <NftChips nfts={nfts!} isStatic={isStatic} />}

        <AddressInput
          value={toAddress}
          error={hasToAddressError ? (lang('Incorrect address') as string) : undefined}
          isStatic={isStatic}
          isFocused={isAddressFocused}
          isQrScannerSupported={isQrScannerSupported}
          withPasteButton={withPasteButton}
          address={resolvedAddress || toAddress}
          addressName={localAddressName || toAddressName}
          inputRef={toAddressRef}
          onInput={handleAddressInput}
          onFocus={handleAddressFocus}
          onBlur={handleAddressBlur}
          onClearClick={handleAddressClearClick}
          onQrScanClick={handleQrScanClick}
          onPasteClick={handlePasteClick}
        />

        {shouldUseAddressBook && (
          <AddressBook
            isOpen={isAddressBookOpen}
            isNftTransfer={isNftTransfer}
            currentAddress={toAddress}
            otherAccountIds={otherAccountIds}
            onAddressSelect={handleAddressBookItemSelect}
            onSavedAddressDelete={handleDeleteSavedAddressClick}
            onClose={closeAddressBook}
          />
        )}

        {!isNftTransfer && (
          <AmountInputSection
            amount={amount}
            decimals={decimals!}
            maxAmount={maxAmount}
            token={transferToken}
            allTokens={tokens}
            tokenSlug={tokenSlug}
            isStatic={isStatic}
            hasAmountError={hasAmountError}
            isMultichainAccount={isMultichainAccount}
            isSensitiveDataHidden={isSensitiveDataHidden}
            shouldRenderCurrency={shouldRenderCurrency}
            currencyValue={renderedCurrencyValue}
            bottomRightElement={renderedBottomRight}
            onChange={handleAmountChange}
            onTokenChange={handleTokenChange}
            onMaxClick={handleMaxAmountClick}
            onPressEnter={handleSubmit}
          />
        )}

        {chain === 'ton' && (
          <CommentSection
            comment={comment}
            shouldEncrypt={shouldEncrypt}
            binPayload={binPayload}
            stateInit={stateInit}
            chain={chain}
            isStatic={isStatic}
            isCommentRequired={isCommentRequired}
            isEncryptedCommentSupported={isEncryptedCommentSupported}
            onCommentChange={handleCommentChange}
          />
        )}

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
        resolvedAddress,
        toAddressName,
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
        resolvedAddress,
        toAddressName,
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
        currentAccountId: global.currentAccountId!,
        accounts: selectNetworkAccounts(global),
        nativeTokenBalance: selectCurrentAccountTokenBalance(global, getNativeToken(getChainBySlug(tokenSlug)).slug),
        diesel,
        isDieselAuthorizationStarted: accountState?.isDieselAuthorizationStarted,
        isMultichainAccount: selectIsMultichainAccount(global, global.currentAccountId!),
        isSensitiveDataHidden: global.settings.isSensitiveDataHidden,
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

function useFeeModal(explainedFee: ExplainedTransferFee) {
  const isAvailable = explainedFee.realFee?.precision !== 'exact';
  const [isOpen, open, close] = useFlag(false);
  const openIfAvailable = isAvailable ? open : undefined;
  return [isOpen, openIfAvailable, close] as const;
}
