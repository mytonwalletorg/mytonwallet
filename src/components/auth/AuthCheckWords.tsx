import React, { memo } from '../../lib/teact/teact';
import { getActions } from '../../global';

import buildClassName from '../../util/buildClassName';

import useLang from '../../hooks/useLang';

import CheckWordsContent from '../common/backup/CheckWordsContent';
import Button from '../ui/Button';

import styles from './Auth.module.scss';

interface OwnProps {
  isActive?: boolean;
  mnemonic?: string[];
  checkIndexes?: number[];
}

const AuthCheckWords = ({ isActive, mnemonic, checkIndexes }: OwnProps) => {
  const lang = useLang();

  const { openMnemonicPage } = getActions();

  return (
    <div className={styles.wrapper}>
      <div className={buildClassName(styles.container, 'custom-scroll')}>

        <div className={styles.header}>
          <Button isSimple isText onClick={openMnemonicPage} className={styles.headerBackBlock}>
            <i className={buildClassName(styles.iconChevron, 'icon-chevron-left')} aria-hidden />
            <span>{lang('Back')}</span>
          </Button>
          <span className={styles.headerTitle}>{lang('Let\'s Check!')}</span>
        </div>

        <CheckWordsContent
          isActive={isActive}
          mnemonic={mnemonic}
          checkIndexes={checkIndexes}
        />
      </div>
    </div>
  );
};

export default memo(AuthCheckWords);
