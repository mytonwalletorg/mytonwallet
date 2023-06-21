import React, {
  memo, useEffect,
  useState,
} from '../../lib/teact/teact';

import { ANIMATED_STICKER_BIG_SIZE_PX } from '../../config';
import buildClassName from '../../util/buildClassName';
import { ANIMATED_STICKERS_PATHS } from '../ui/helpers/animatedAssets';

import useLang from '../../hooks/useLang';

import AnimatedIconWithPreview from '../ui/AnimatedIconWithPreview';
import Button from '../ui/Button';
import ModalHeader from '../ui/ModalHeader';
import Transition from '../ui/Transition';

import modalStyles from '../ui/Modal.module.scss';
import styles from './LedgerModal.module.scss';

interface OwnProps {
  error?: string;
  onClose: () => void;
  onTryAgain: () => void;
}

enum ConfirmTransactionState {
  Waiting,
  Error,
}

function LedgerConfirmTransaction({
  error, onClose, onTryAgain,
}: OwnProps) {
  const lang = useLang();

  const [activeState, setActiveState] = useState(ConfirmTransactionState.Waiting);
  const [nextKey, setNextKey] = useState(ConfirmTransactionState.Error);

  useEffect(() => {
    if (error) {
      setActiveState(ConfirmTransactionState.Error);
      setNextKey(ConfirmTransactionState.Waiting);
    } else {
      setActiveState(ConfirmTransactionState.Waiting);
      setNextKey(ConfirmTransactionState.Error);
    }
  }, [error]);

  function renderWaitingConfirm(isActive: boolean) {
    return (
      <>
        <ModalHeader title={lang('Confirm via Ledger')} onClose={onClose} />
        <div className={styles.container}>
          <AnimatedIconWithPreview
            size={ANIMATED_STICKER_BIG_SIZE_PX}
            play={isActive}
            noLoop={false}
            nonInteractive
            className={styles.sticker}
            tgsUrl={ANIMATED_STICKERS_PATHS.holdTon}
            previewUrl={ANIMATED_STICKERS_PATHS.holdTonPreview}
          />
          <div className={buildClassName(styles.textBlock, styles.textBlock_small)}>
            <span className={styles.text}>{lang('Please confirm transaction on your Ledger')}</span>
          </div>
          <div className={buildClassName(styles.actionBlock, styles.actionBlock_single)}>
            <Button onClick={onClose} className={styles.button}>{lang('Cancel')}</Button>
          </div>
        </div>
      </>
    );
  }

  function renderTryAgain(isActive: boolean) {
    return (
      <>
        <ModalHeader title={lang('Confirm via Ledger')} onClose={onClose} />
        <div className={styles.container}>
          <AnimatedIconWithPreview
            size={ANIMATED_STICKER_BIG_SIZE_PX}
            play={isActive}
            noLoop={false}
            nonInteractive
            className={styles.sticker}
            tgsUrl={ANIMATED_STICKERS_PATHS.holdTon}
            previewUrl={ANIMATED_STICKERS_PATHS.holdTonPreview}
          />
          <div className={buildClassName(styles.textBlock, styles.textBlock_small)}>
            <span className={styles.text}>{lang('Please confirm transaction on your Ledger')}</span>
          </div>
          <span className={styles.declinedLabel}>{lang('Declined')}</span>
          <div className={styles.actionBlock}>
            <Button onClick={onClose} className={styles.button}>{lang('Cancel')}</Button>
            <Button isPrimary onClick={onTryAgain} className={styles.button}>{lang('Try Again')}</Button>
          </div>
        </div>
      </>
    );
  }

  // eslint-disable-next-line consistent-return
  function renderContent(isActive: boolean, isFrom: boolean, currentKey: number) {
    switch (currentKey) {
      case ConfirmTransactionState.Waiting:
        return renderWaitingConfirm(isActive);
      case ConfirmTransactionState.Error:
        return renderTryAgain(isActive);
    }
  }

  return (
    <Transition
      name="pushSlide"
      className={buildClassName(modalStyles.transition, 'custom-scroll')}
      slideClassName={buildClassName(modalStyles.transitionSlide, styles.slide)}
      activeKey={activeState}
      nextKey={nextKey}
    >
      {renderContent}
    </Transition>
  );
}

export default memo(LedgerConfirmTransaction);
