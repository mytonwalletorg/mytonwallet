import React, { memo } from '../../lib/teact/teact';

import { MNEMONIC_COUNT } from '../../config';
import buildClassName from '../../util/buildClassName';

import ModalHeader from '../ui/ModalHeader';
import Button from '../ui/Button';

import styles from './Auth.module.scss';
import modalStyles from '../ui/Modal.module.scss';

type OwnProps = {
  mnemonic?: string[];
  onClose: NoneToVoidFunction;
  onNext: NoneToVoidFunction;
};

function MnemonicList({
  mnemonic, onNext, onClose,
}: OwnProps) {
  return (
    <div className={modalStyles.transitionContentWrapper}>
      <ModalHeader title={`${MNEMONIC_COUNT} Secret Words`} onClose={onClose} />
      <div className={buildClassName(modalStyles.transitionContent, 'custom-scroll')}>
        <p className={buildClassName(styles.info, styles.small)}>
          Write down these words
          <br />in the <strong>correct order</strong> and store them
          <br />in a <strong>secret place</strong>.
        </p>
        <ol className={styles.words}>
          {mnemonic?.map((word) => (
            <li className={styles.word}>{word}</li>
          ))}
        </ol>

        <div className={modalStyles.buttons}>
          <Button isPrimary onClick={onNext}>Let{'\''}s check</Button>
        </div>
      </div>
    </div>
  );
}

export default memo(MnemonicList);
