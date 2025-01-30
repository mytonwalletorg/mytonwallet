import React, {
  memo, type TeactNode, useEffect, useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type {
  ApiStakingCommonData,
  ApiStakingState,
  ApiTokenWithPrice,
  ApiToncoinStakingState,
  ApiTransactionActivity,
} from '../../../api/types';
import type { SavedAddress, Theme } from '../../../global/types';
import { ActiveTab } from '../../../global/types';

import {
  ANIMATED_STICKER_TINY_ICON_PX,
  ANIMATION_END_DELAY,
  ANIMATION_LEVEL_MIN,
  IS_CAPACITOR,
  STAKING_CYCLE_DURATION_MS,
  TONCOIN,
} from '../../../config';
import { getIsTxIdLocal } from '../../../global/helpers';
import { getStakingStateStatus } from '../../../global/helpers/staking';
import { selectAccountStakingStates, selectCurrentAccountState } from '../../../global/selectors';
import { bigintAbs } from '../../../util/bigint';
import buildClassName from '../../../util/buildClassName';
import { vibrateOnSuccess } from '../../../util/capacitor';
import { formatFullDay, formatRelativeHumanDateTime, formatTime } from '../../../util/dateFormat';
import { toDecimal } from '../../../util/decimals';
import { handleOpenUrl } from '../../../util/openUrl';
import { getIsTransactionWithPoisoning } from '../../../util/poisoningHash';
import resolveSlideTransitionName from '../../../util/resolveSlideTransitionName';
import { getNativeToken, getTransactionHashFromTxId } from '../../../util/tokens';
import { getExplorerName, getExplorerTransactionUrl } from '../../../util/url';
import { callApi } from '../../../api';
import { ANIMATED_STICKERS_PATHS } from '../../ui/helpers/animatedAssets';

import useAppTheme from '../../../hooks/useAppTheme';
import { useDeviceScreen } from '../../../hooks/useDeviceScreen';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import usePrevDuringAnimation from '../../../hooks/usePrevDuringAnimation';
import useShowTransition from '../../../hooks/useShowTransition';
import useSyncEffect from '../../../hooks/useSyncEffect';

import TransactionAmount from '../../common/TransactionAmount';
import NftInfo from '../../transfer/NftInfo';
import AmountWithFeeTextField from '../../ui/AmountWithFeeTextField';
import AnimatedIconWithPreview from '../../ui/AnimatedIconWithPreview';
import Button from '../../ui/Button';
import InteractiveTextField from '../../ui/InteractiveTextField';
import Modal, { CLOSE_DURATION, CLOSE_DURATION_PORTRAIT } from '../../ui/Modal';
import ModalHeader from '../../ui/ModalHeader';
import PasswordForm from '../../ui/PasswordForm';
import Transition from '../../ui/Transition';

import transferStyles from '../../transfer/Transfer.module.scss';
import modalStyles from '../../ui/Modal.module.scss';
import styles from './TransactionModal.module.scss';

import scamImg from '../../../assets/scam.svg';

type StateProps = {
  transaction?: ApiTransactionActivity;
  tokensBySlug?: Record<string, ApiTokenWithPrice>;
  savedAddresses?: SavedAddress[];
  isTestnet?: boolean;
  stakingInfo?: ApiStakingCommonData;
  stakingStates?: ApiStakingState[];
  isLongUnstakeRequested?: boolean;
  isMediaViewerOpen?: boolean;
  theme: Theme;
};

const enum SLIDES {
  initial,
  password,
}

function TransactionModal({
  transaction,
  tokensBySlug,
  savedAddresses,
  isTestnet,
  stakingInfo,
  stakingStates,
  isLongUnstakeRequested,
  isMediaViewerOpen,
  theme,
}: StateProps) {
  const {
    startTransfer,
    startStaking,
    startUnstaking,
    closeActivityInfo,
    setIsPinAccepted,
    clearIsPinAccepted,
    setLandscapeActionsActiveTabIndex,
  } = getActions();

  const lang = useLang();
  const { isPortrait } = useDeviceScreen();
  const [currentSlide, setCurrentSlide] = useState<number>(SLIDES.initial);
  const [nextKey, setNextKey] = useState<number | undefined>(SLIDES.password);
  const animationLevel = getGlobal().settings.animationLevel;
  const animationDuration = animationLevel === ANIMATION_LEVEL_MIN
    ? 0
    : (isPortrait ? CLOSE_DURATION_PORTRAIT : CLOSE_DURATION) + ANIMATION_END_DELAY;
  const renderedTransaction = usePrevDuringAnimation(transaction, animationDuration);
  const [unstakeDate, setUnstakeDate] = useState<number>(Date.now() + STAKING_CYCLE_DURATION_MS);
  const appTheme = useAppTheme(theme);

  const {
    fromAddress,
    toAddress,
    amount,
    comment,
    encryptedComment,
    fee,
    id,
    isIncoming,
    slug,
    timestamp,
    nft,
  } = renderedTransaction || {};
  const isStaking = renderedTransaction?.type === 'stake' || renderedTransaction?.type === 'unstake';
  const isUnstaking = renderedTransaction?.type === 'unstake';
  const isNftTransfer = (
    renderedTransaction?.type === 'nftTransferred'
    || renderedTransaction?.type === 'nftReceived'
    || Boolean(renderedTransaction?.nft)
  );

  const token = slug ? tokensBySlug?.[slug] : undefined;
  const chain = token?.chain;

  const nativeToken = token ? getNativeToken(token.chain) : undefined;
  const address = isIncoming ? fromAddress : toAddress;
  const savedAddressName = useMemo(() => {
    return address && chain && savedAddresses?.find((item) => item.address === address && item.chain === chain)?.name;
  }, [address, chain, savedAddresses]);
  const addressName = savedAddressName || transaction?.metadata?.name;
  const isTransactionWithPoisoning = isIncoming && getIsTransactionWithPoisoning(renderedTransaction!);
  const isScam = isTransactionWithPoisoning || Boolean(transaction?.metadata?.isScam);
  const isModalOpen = Boolean(transaction) && !isMediaViewerOpen;
  const transactionHash = chain && id ? getTransactionHashFromTxId(chain, id) : undefined;

  const [decryptedComment, setDecryptedComment] = useState<string>();
  const [passwordError, setPasswordError] = useState<string>();

  const transactionUrl = chain ? getExplorerTransactionUrl(chain, transactionHash, isTestnet) : undefined;
  const explorerTitle = useMemo(() => {
    return chain
      ? (lang('View Transaction on %ton_explorer_name%', {
        ton_explorer_name: getExplorerName(chain),
      }) as TeactNode[]
      ).join('')
      : undefined;
  }, [lang, chain]);

  const [withUnstakeTimer, setWithUnstakeTimer] = useState(false);

  const state = useMemo(() => {
    return stakingStates?.find((staking): staking is ApiToncoinStakingState => {
      return staking.tokenSlug === TONCOIN.slug && staking.balance > 0n;
    });
  }, [stakingStates]);

  const stakingStatus = state && getStakingStateStatus(state);
  const startOfStakingCycle = state?.type === 'nominators' ? state.start : stakingInfo?.round?.start;
  const endOfStakingCycle = state?.type === 'nominators' ? state.end : stakingInfo?.round?.end;

  useEffect(() => {
    if (transaction?.type !== 'unstakeRequest' || !startOfStakingCycle) {
      return;
    }

    const shouldDisplayTimer = Boolean(stakingStatus === 'unstakeRequested' || isLongUnstakeRequested)
      && transaction.timestamp >= startOfStakingCycle;
    setWithUnstakeTimer(shouldDisplayTimer);
  }, [stakingStatus, startOfStakingCycle, transaction, isLongUnstakeRequested]);

  const {
    shouldRender: shouldRenderUnstakeTimer,
    transitionClassNames: unstakeTimerClassNames,
  } = useShowTransition(withUnstakeTimer);

  useSyncEffect(() => {
    if (renderedTransaction) {
      setDecryptedComment(undefined);
    }
  }, [renderedTransaction]);

  useSyncEffect(() => {
    if (endOfStakingCycle) {
      setUnstakeDate(endOfStakingCycle);
    }
  }, [endOfStakingCycle]);

  const clearPasswordError = useLastCallback(() => {
    setPasswordError(undefined);
  });

  const openPasswordSlide = useLastCallback(() => {
    setCurrentSlide(SLIDES.password);
    setNextKey(undefined);
  });

  const closePasswordSlide = useLastCallback(() => {
    setCurrentSlide(SLIDES.initial);
    setNextKey(SLIDES.password);
    clearPasswordError();
  });

  const openHiddenComment = useLastCallback(() => {
    if (!encryptedComment) {
      return;
    }

    openPasswordSlide();
  });

  const handleSendClick = useLastCallback(() => {
    closeActivityInfo({ id: id! });
    startTransfer({
      isPortrait,
      tokenSlug: slug || TONCOIN.slug,
      toAddress: address,
      amount: bigintAbs(amount!),
      comment: !isIncoming ? comment : undefined,
    });
  });

  const handleStartStakingClick = useLastCallback(() => {
    closeActivityInfo({ id: id! });

    if (!isPortrait) {
      setLandscapeActionsActiveTabIndex({ index: ActiveTab.Stake });
      return;
    }

    startStaking();
  });

  const handleUnstakeMoreClick = useLastCallback(() => {
    closeActivityInfo({ id: id! });

    if (!isPortrait) {
      setLandscapeActionsActiveTabIndex({ index: ActiveTab.Stake });
    }

    startUnstaking();
  });

  const handlePasswordSubmit = useLastCallback(async (password: string) => {
    const result = await callApi(
      'decryptComment',
      getGlobal().currentAccountId!,
      encryptedComment!,
      fromAddress!,
      password,
    );

    if (!result) {
      setPasswordError('Wrong password, please try again.');
      return;
    }

    if (IS_CAPACITOR) {
      setIsPinAccepted();
      await vibrateOnSuccess(true);
    }

    closePasswordSlide();
    setDecryptedComment(result);
  });

  const handleClose = useLastCallback(() => {
    closeActivityInfo({ id: id! });
    if (IS_CAPACITOR) {
      clearIsPinAccepted();
    }
  });

  function getTitle(isLocal: boolean) {
    if (isUnstaking) {
      return isLocal ? 'Unstaking' : 'Unstaked';
    }
    if (isIncoming) return 'Received';

    return isLocal ? 'Sending' : 'Sent';
  }

  function renderHeader() {
    const isLocal = Boolean(id && getIsTxIdLocal(id));

    return (
      <div
        className={buildClassName(
          modalStyles.header,
          modalStyles.header_wideContent,
        )}
      >
        <div className={buildClassName(modalStyles.title, styles.modalTitle)}>
          <div className={styles.headerTitle}>
            {lang(getTitle(isLocal))}
            {isLocal && (
              <AnimatedIconWithPreview
                play={isModalOpen}
                size={ANIMATED_STICKER_TINY_ICON_PX}
                nonInteractive
                noLoop={false}
                tgsUrl={ANIMATED_STICKERS_PATHS[appTheme].iconClock}
                previewUrl={ANIMATED_STICKERS_PATHS[appTheme].preview.iconClock}
              />
            )}
            {isScam && isIncoming && <img src={scamImg} alt={lang('Scam')} className={styles.scamImage} />}
          </div>
          {!!timestamp && (
            <div className={styles.headerDate}>
              {formatFullDay(lang.code!, timestamp)}, {formatTime(timestamp)}
            </div>
          )}
        </div>
        <Button
          isRound
          className={modalStyles.closeButton}
          ariaLabel={lang('Close')}
          onClick={handleClose}
        >
          <i className={buildClassName(modalStyles.closeIcon, 'icon-close')} aria-hidden />
        </Button>
      </div>
    );
  }

  function renderTransactionWithPoisoningWarning() {
    return (
      <div className={styles.scamWarning}>
        {lang('This address mimics another address that you previously interacted with.')}
      </div>
    );
  }

  function renderFee() {
    if (isIncoming || !fee || !nativeToken) {
      return undefined;
    }

    return (
      <AmountWithFeeTextField
        label={lang('Fee')}
        amount={toDecimal(fee, nativeToken.decimals)}
        currency={nativeToken.symbol}
      />
    );
  }

  function renderComment() {
    if ((!comment && !encryptedComment) || (transaction?.type && !isNftTransfer)) {
      return undefined;
    }

    const spoiler = encryptedComment
      ? lang('Message is encrypted.')
      : isScam
        ? lang('Scam comment is hidden.')
        : undefined;

    return (
      <>
        <div className={transferStyles.label}>{lang('Comment')}</div>
        <InteractiveTextField
          text={encryptedComment ? decryptedComment : comment}
          spoiler={spoiler}
          spoilerRevealText={encryptedComment ? lang('Decrypt') : lang('Display')}
          spoilerCallback={openHiddenComment}
          copyNotification={lang('Comment was copied!')}
          className={styles.copyButtonWrapper}
          textClassName={styles.comment}
        />
      </>
    );
  }

  function renderUnstakeTimer() {
    return (
      <div className={buildClassName(styles.unstakeTime, unstakeTimerClassNames)}>
        <AnimatedIconWithPreview
          play={isModalOpen}
          size={ANIMATED_STICKER_TINY_ICON_PX}
          className={styles.unstakeTimeIcon}
          nonInteractive
          noLoop={false}
          tgsUrl={ANIMATED_STICKERS_PATHS[appTheme].iconClockGray}
          previewUrl={ANIMATED_STICKERS_PATHS[appTheme].preview.iconClockGray}
        />
        <div>
          {lang('$unstaking_when_receive', {
            time: (
              <strong>
                {formatRelativeHumanDateTime(lang.code, unstakeDate)}
              </strong>
            ),
          })}
        </div>
      </div>
    );
  }

  function renderTransactionContent() {
    return (
      <>
        {isNftTransfer ? (
          <NftInfo nft={nft} withTonExplorer />
        ) : (
          <TransactionAmount
            isIncoming={isIncoming}
            isScam={isScam}
            amount={amount ?? 0n}
            decimals={token?.decimals}
            tokenSymbol={token?.symbol}
            status={isUnstaking && !shouldRenderUnstakeTimer ? lang('Successfully') : undefined}
          />
        )}

        {isTransactionWithPoisoning && renderTransactionWithPoisoningWarning()}

        {!isUnstaking && (
          <>
            <div className={transferStyles.label}>{lang(isIncoming ? 'Sender' : 'Recipient')}</div>
            <InteractiveTextField
              chain={chain}
              addressName={addressName}
              address={address!}
              isScam={isScam && !isIncoming}
              copyNotification={lang('Address was copied!')}
              className={styles.copyButtonWrapper}
              textClassName={isScam && isIncoming ? styles.scamAddress : undefined}
            />
          </>
        )}

        {renderFee()}
        {renderComment()}
        {shouldRenderUnstakeTimer && renderUnstakeTimer()}

        <div className={styles.footer}>
          {!isStaking && !isIncoming && !isNftTransfer && (
            <Button onClick={handleSendClick} className={styles.button}>
              {lang('Repeat')}
            </Button>
          )}
          {isStaking && (
            <Button
              onClick={handleStartStakingClick}
              className={buildClassName(styles.button, isUnstaking && stakingStatus === 'active' && styles.buttonWide)}
            >
              {lang('Stake Again')}
            </Button>
          )}
          {isUnstaking && stakingStatus === 'active' && (
            <Button onClick={handleUnstakeMoreClick} className={buildClassName(styles.button, styles.buttonWide)}>
              {lang('Unstake More')}
            </Button>
          )}
        </div>
      </>
    );
  }

  // eslint-disable-next-line consistent-return
  function renderContent(isActive: boolean, isFrom: boolean, currentKey: number) {
    switch (currentKey) {
      case SLIDES.initial:
        return (
          <>
            {renderHeader()}
            <div className={modalStyles.transitionContent}>
              {transactionUrl && (
                <a
                  href={transactionUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className={styles.tonExplorer}
                  title={explorerTitle}
                  aria-label={explorerTitle}
                  onClick={handleOpenUrl}
                >
                  <i className="icon-tonexplorer" aria-hidden />
                </a>
              )}
              {renderTransactionContent()}
            </div>
          </>
        );
      case SLIDES.password:
        if (!encryptedComment) return undefined;

        return (
          <>
            {!IS_CAPACITOR && <ModalHeader title={lang('Enter Password')} onClose={handleClose} />}
            <PasswordForm
              isActive={isActive}
              error={passwordError}
              withCloseButton={IS_CAPACITOR}
              containerClassName={IS_CAPACITOR ? styles.passwordFormContent : styles.passwordFormContentInModal}
              submitLabel={lang('Send')}
              onSubmit={handlePasswordSubmit}
              onCancel={closePasswordSlide}
              onUpdate={clearPasswordError}
            />
          </>
        );
    }
  }

  return (
    <Modal
      isOpen={isModalOpen}
      hasCloseButton
      nativeBottomSheetKey="transaction-info"
      forceFullNative={currentSlide === SLIDES.password}
      dialogClassName={buildClassName(styles.modalDialog, isUnstaking && styles.unstakeModal)}
      onClose={handleClose}
      onCloseAnimationEnd={closePasswordSlide}
    >
      <Transition
        name={resolveSlideTransitionName()}
        className={buildClassName(modalStyles.transition, 'custom-scroll')}
        slideClassName={modalStyles.transitionSlide}
        activeKey={currentSlide}
        nextKey={nextKey}
      >
        {renderContent}
      </Transition>
    </Modal>
  );
}

export default memo(
  withGlobal((global): StateProps => {
    const accountId = global.currentAccountId!;
    const accountState = selectCurrentAccountState(global);

    const txId = accountState?.currentActivityId;
    const activity = txId ? accountState?.activities?.byId[txId] : undefined;
    const savedAddresses = accountState?.savedAddresses;

    const stakingInfo = global.stakingInfo;
    const stakingStates = selectAccountStakingStates(global, accountId);

    return {
      transaction: activity?.kind === 'transaction' ? activity : undefined,
      tokensBySlug: global.tokenInfo?.bySlug,
      savedAddresses,
      isTestnet: global.settings.isTestnet,
      isLongUnstakeRequested: accountState?.isLongUnstakeRequested,
      isMediaViewerOpen: Boolean(global.mediaViewer.mediaId),
      theme: global.settings.theme,
      stakingInfo,
      stakingStates,
    };
  })(TransactionModal),
);
