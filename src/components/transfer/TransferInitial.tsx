import type { TeactNode } from '../../lib/teact/teact';
import React, {
  memo, useEffect, useMemo, useRef,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiFetchEstimateDieselResult } from '../../api/chains/ton/types';
import type { ApiBaseCurrency, ApiNft } from '../../api/types';
import type { Account, SavedAddress, UserToken } from '../../global/types';
import type { ExplainedTransferFee } from '../../util/fee/transferFee';
import type { FeePrecision, FeeTerms } from '../../util/fee/types';
import { TransferState } from '../../global/types';

import { TONCOIN } from '../../config';
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
import { SECOND } from '../../util/dateFormat';
import { fromDecimal, toBig } from '../../util/decimals';
import { stopEvent } from '../../util/domEvents';
import {
  explainApiTransferFee, getMaxTransferAmount, isBalanceSufficientForTransfer,
} from '../../util/fee/transferFee';
import { formatCurrency, getShortCurrencySymbol } from '../../util/formatNumber';
import { vibrate } from '../../util/haptics';
import { isValidAddressOrDomain } from '../../util/isValidAddressOrDomain';
import { debounce } from '../../util/schedulers';
import { trimStringByMaxBytes } from '../../util/text';
import { getChainBySlug, getIsServiceToken, getNativeToken } from '../../util/tokens';

import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';
import useFlag from '../../hooks/useFlag';
import useInterval from '../../hooks/useInterval';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useShowTransition from '../../hooks/useShowTransition';

import FeeDetailsModal from '../common/FeeDetailsModal';
import AddressInput from '../ui/AddressInput';
import Button from '../ui/Button';
import FeeLine from '../ui/FeeLine';
import Transition from '../ui/Transition';
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
    fetchTransferFee,
    fetchNftFee,
    changeTransferToken,
    setTransferAmount,
    setTransferToAddress,
    setTransferComment,
    setTransferShouldEncrypt,
    cancelTransfer,
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

  const lang = useLang();

  const transferToken = useMemo(() => tokens?.find((token) => token.slug === tokenSlug), [tokenSlug, tokens]);
  const {
    amount: balance,
    decimals,
    price,
    symbol,
    chain,
  } = transferToken || {};

  const isDisabledDebounce = useRef<boolean>(false);
  const isToncoin = tokenSlug === TONCOIN.slug;
  const isAddressValid = chain ? isValidAddressOrDomain(toAddress, chain) : undefined;

  const handleAddressInput = useLastCallback((newToAddress?: string, isValueReplaced?: boolean) => {
    // If value is replaced, callbacks must be executed immediately, without debounce
    if (isValueReplaced) {
      isDisabledDebounce.current = true;
    }

    setTransferToAddress({ toAddress: newToAddress });
  });

  const shouldDisableClearButton = !toAddress && !(comment || binPayload) && !shouldEncrypt
    && !(isNftTransfer ? isStatic : amount !== undefined);

  const amountInCurrency = price && amount
    ? toBig(amount, decimals).mul(price).round(decimals, Big.roundHalfUp).toString()
    : undefined;
  const renderingAmountInCurrency = useCurrentOrPrev(amountInCurrency, true);
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
    nativeTokenBalance,
    transferAmount: isNftTransfer ? 0n : amount,
    fullFee: explainedFee.fullFee?.terms,
    canTransferFullBalance: explainedFee.canTransferFullBalance,
  });

  const isAmountMissing = !isNftTransfer && !amount;

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

  const { shouldRender: shouldRenderCurrency, ref: currencyRef } = useShowTransition({
    isOpen: Boolean(amountInCurrency),
    withShouldRender: true,
  });
  const renderedCurrencyValue = useMemo(() => {
    return (
      <span ref={currencyRef} className={styles.amountInCurrency}>
        ≈&thinsp;{formatCurrency(renderingAmountInCurrency || '0', shortBaseSymbol, undefined, true)}
      </span>
    );
  }, [currencyRef, renderingAmountInCurrency, shortBaseSymbol]);

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
    if (getIsServiceToken(transferToken)) {
      showDialog({
        title: lang('Warning!'),
        message: lang('$service_token_transfer_warning'),
        noBackdropClose: true,
      });
    }
  }, [lang, transferToken]);

  const handleTokenChange = useLastCallback((slug: string) => {
    changeTransferToken({ tokenSlug: slug });
  });

  const handleClear = useLastCallback(() => {
    if (isStatic) {
      cancelTransfer({ shouldReset: true });
    } else {
      handleAddressInput('');
      checkTransferAddress({ address: '' });
      setTransferAmount({ amount: undefined });
      setTransferComment({ comment: undefined });
      setTransferShouldEncrypt({ shouldEncrypt: false });
    }
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
        {Boolean(nfts?.length) && nfts.length > 1 && <NftChips nfts={nfts} isStatic={isStatic} />}

        <AddressInput
          label={lang('Recipient Address')}
          value={toAddress}
          chain={chain}
          // NFT transfers are available only on the TON blockchain on this moment
          addressBookChain={isNftTransfer ? 'ton' : undefined}
          currentAccountId={currentAccountId}
          accounts={accounts}
          savedAddresses={savedAddresses}
          validateAddress={checkTransferAddress}
          isStatic={isStatic}
          withQrScan
          address={resolvedAddress || toAddress}
          addressName={toAddressName}
          onInput={handleAddressInput}
          onClose={cancelTransfer}
        />

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
