import React, { memo } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import useHistoryBack from '../../hooks/useHistoryBack';
import useLang from '../../hooks/useLang';

import SecretWordsList from '../common/backup/SecretWordsList';
import Button from '../ui/Button';
import ModalHeader from '../ui/ModalHeader';

import modalStyles from '../ui/Modal.module.scss';
import styles from './Auth.module.scss';

type OwnProps = {
  isActive?: boolean;
  mnemonic?: string[];
  onClose: NoneToVoidFunction;
  onNext?: NoneToVoidFunction;
};

function MnemonicList({
  isActive, mnemonic, onNext, onClose,
}: OwnProps) {
  const lang = useLang();
  const wordsCount = mnemonic?.length || 0;

  useHistoryBack({
    isActive,
    onBack: onClose,
  });

  return (
    <div className={modalStyles.transitionContentWrapper}>
      <ModalHeader title={lang('%1$d Secret Words', wordsCount) as string} onClose={onClose} />
      <div className={buildClassName(styles.mnemonicContainer, modalStyles.transitionContent, 'custom-scroll')}>
        <SecretWordsList mnemonic={mnemonic} />
        {onNext && (
          <div className={modalStyles.buttons}>
            <Button isPrimary onClick={onNext}>{lang('Let\'s Check')}</Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(MnemonicList);
