import React, {
  memo, useCallback, useEffect, useMemo, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { GlobalState, UserToken } from '../../global/types';
import { TransferState } from '../../global/types';

import { ANIMATED_STICKER_SMALL_SIZE_PX, TON_TOKEN_SLUG } from '../../config';
import { ANIMATED_STICKERS_PATHS } from '../ui/helpers/animatedAssets';
import buildClassName from '../../util/buildClassName';
import { selectCurrentAccountTokens } from '../../global/selectors';
import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';
import useLang from '../../hooks/useLang';

import Modal from '../ui/Modal';
import Transition from '../ui/Transition';
import ModalHeader from '../ui/ModalHeader';
import DappTransferInitial from './DappTransferInitial';
import PasswordForm from '../ui/PasswordForm';
import Button from '../ui/Button';
import AnimatedIconWithPreview from '../ui/AnimatedIconWithPreview';
import DappTransaction from './DappTransaction';

import modalStyles from '../ui/Modal.module.scss';
import styles from './Dapp.module.scss';

interface StateProps {
  currentDappTransfer: GlobalState['currentDappTransfer'];
  tokens?: UserToken[];
}

function DappTransactionModal({
  currentDappTransfer: {
    transactions,
    isLoading,
    viewTransactionOnIdx,
    state,
    error,
  },
  tokens,
}: StateProps) {
  const {
    setDappTransferScreen,
    clearDappTransferError,
    submitDappTransferPassword,
    cancelDappTransfer,
  } = getActions();

  const lang = useLang();
  const tonToken = useMemo(() => tokens?.find(({ slug }) => slug === TON_TOKEN_SLUG), [tokens])!;

  const isOpen = state !== TransferState.None;
  const renderingState = useCurrentOrPrev(isOpen ? state : undefined, true) ?? -1;
  const [nextKey, setNextKey] = useState(renderingState + 1);
  const updateNextKey = useCallback(() => {
    setNextKey(renderingState + 1);
  }, [renderingState]);

  const handleBackClick = useCallback(() => {
    if (state === TransferState.Confirm || state === TransferState.Password) {
      setDappTransferScreen({ state: TransferState.Initial });
    }
    setNextKey(nextKey - 1);
  }, [nextKey, setDappTransferScreen, state]);

  const handleTransferSubmit = useCallback((password: string) => {
    submitDappTransferPassword({ password });
  }, [submitDappTransferPassword]);

  useEffect(() => {
    if (isOpen) {
      updateNextKey();
    }
  }, [isOpen, updateNextKey]);

  const handleModalClose = useCallback(() => {
    setNextKey(TransferState.None);
  }, []);

  function renderSingleTransaction(isActive: boolean) {
    const transaction = viewTransactionOnIdx !== undefined ? transactions?.[viewTransactionOnIdx] : undefined;

    return (
      <>
        <ModalHeader title={lang('Is it all ok?')} onClose={cancelDappTransfer} />
        <div className={modalStyles.transitionContent}>
          <AnimatedIconWithPreview
            size={ANIMATED_STICKER_SMALL_SIZE_PX}
            play={isActive}
            noLoop={false}
            nonInteractive
            className={buildClassName(styles.sticker, styles.sticker_sizeSmall)}
            tgsUrl={ANIMATED_STICKERS_PATHS.bill}
            previewUrl={ANIMATED_STICKERS_PATHS.billPreview}
          />

          {Boolean(transaction) && (
            <DappTransaction
              transaction={transaction}
              tonToken={tonToken}
              tokens={tokens}
            />
          )}
          <div className={modalStyles.buttons}>
            <Button onClick={handleBackClick}>{lang('Back')}</Button>
          </div>
        </div>
      </>
    );
  }

  function renderPassword(isActive: boolean) {
    return (
      <>
        <ModalHeader title={lang('Confirm Transaction')} onClose={cancelDappTransfer} />
        <PasswordForm
          isActive={isActive}
          isLoading={isLoading}
          error={error}
          placeholder={lang('Enter your password')}
          onUpdate={clearDappTransferError}
          onSubmit={handleTransferSubmit}
          submitLabel={lang('Send')}
          onCancel={handleBackClick}
          cancelLabel={lang('Back')}
        />
      </>
    );
  }

  // eslint-disable-next-line consistent-return
  function renderContent(isActive: boolean, isFrom: boolean, currentKey: number) {
    switch (currentKey) {
      case TransferState.Initial:
        return (
          <>
            <ModalHeader title={lang('Send Transaction')} onClose={cancelDappTransfer} />
            <DappTransferInitial tonToken={tonToken} />
          </>
        );

      case TransferState.Confirm:
        return renderSingleTransaction(isActive);

      case TransferState.Password:
        return renderPassword(isActive);
    }
  }

  return (
    <Modal
      hasCloseButton
      isSlideUp
      isOpen={isOpen}
      onClose={cancelDappTransfer}
      noBackdropClose
      onCloseAnimationEnd={handleModalClose}
      dialogClassName={styles.modalDialog}
    >
      <Transition
        name="push-slide"
        className={buildClassName(modalStyles.transition, 'custom-scroll')}
        slideClassName={modalStyles.transitionSlide}
        activeKey={renderingState}
        nextKey={nextKey}
        onStop={updateNextKey}
      >
        {renderContent}
      </Transition>
    </Modal>
  );
}

export default memo(withGlobal((global): StateProps => {
  return {
    currentDappTransfer: global.currentDappTransfer,
    tokens: selectCurrentAccountTokens(global),
  };
})(DappTransactionModal));
