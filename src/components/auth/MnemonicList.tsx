import React, { memo } from '../../lib/teact/teact';

import { MNEMONIC_COUNT } from '../../config';
import renderText from '../../global/helpers/renderText';
import buildClassName from '../../util/buildClassName';
import useLang from '../../hooks/useLang';

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
  const lang = useLang();

  return (
    <div className={modalStyles.transitionContentWrapper}>
      <ModalHeader title={lang('%1$d Secret Words', MNEMONIC_COUNT) as string} onClose={onClose} />
      <div className={buildClassName(modalStyles.transitionContent, 'custom-scroll')}>
        <p className={buildClassName(styles.info, styles.small)}>
          {renderText(lang('$mnemonic_list_description'))}
        </p>
        <ol className={styles.words}>
          {mnemonic?.map((word) => (
            <li className={styles.word}>{word}</li>
          ))}
        </ol>

        <div className={modalStyles.buttons}>
          <Button isPrimary onClick={onNext}>{lang('Let\'s Check')}</Button>
        </div>
      </div>
    </div>
  );
}

export default memo(MnemonicList);
