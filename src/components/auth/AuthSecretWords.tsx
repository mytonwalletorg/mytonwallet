import React, { memo } from '../../lib/teact/teact';
import { getActions } from '../../global';

import buildClassName from '../../util/buildClassName';

import useLang from '../../hooks/useLang';

import SecretWordsContent from '../common/backup/SecretWordsContent';
import Button from '../ui/Button';

import styles from './Auth.module.scss';

interface OwnProps {
  isActive?: boolean;
  mnemonic?: string[];
}

const AuthSecretWords = ({ isActive, mnemonic }: OwnProps) => {
  const { openAuthBackupWalletModal, openCheckWordsPage } = getActions();

  const lang = useLang();

  const wordsCount = mnemonic?.length || 0;

  return (
    <div className={styles.wrapper}>
      <div className={buildClassName(styles.container, 'custom-scroll')}>

        <div className={styles.header}>
          <Button isSimple isText onClick={openAuthBackupWalletModal} className={styles.headerBackBlock}>
            <i className={buildClassName(styles.iconChevron, 'icon-chevron-left')} aria-hidden />
            <span>{lang('Back')}</span>
          </Button>
          <span className={styles.headerTitle}>{lang('%1$d Secret Words', wordsCount) as string}</span>
        </div>

        <SecretWordsContent
          isActive={isActive}
          mnemonic={mnemonic}
          onSubmit={openCheckWordsPage}
          buttonText={lang('Let\'s Check')}
        />
      </div>
    </div>
  );
};

export default memo(AuthSecretWords);
