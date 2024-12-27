import React, { memo, useState } from '../../lib/teact/teact';
import { getActions } from '../../global';

import buildClassName from '../../util/buildClassName';

import useLang from '../../hooks/useLang';

import SaferyRulesContent from '../common/backup/SaferyRulesContent';
import Button from '../ui/Button';

import styles from './Auth.module.scss';

interface OwnProps {
  isActive?: boolean;
}

const AuthSaferyRules = ({ isActive }: OwnProps) => {
  const { openCreateBackUpPage, openMnemonicPage } = getActions();

  const [writedownAccepted, setWritedownAccepted] = useState(false);
  const [openWalletAccepted, setOpenWalletAccepted] = useState(false);
  const [canBeStolenAccepted, setCanBeStolenAccepted] = useState(false);

  const lang = useLang();

  return (
    <div className={styles.wrapper}>
      <div className={buildClassName(styles.container, 'custom-scroll')}>
        <div className={styles.header}>
          <Button isSimple isText onClick={openCreateBackUpPage} className={styles.headerBackBlock}>
            <i className={buildClassName(styles.iconChevron, 'icon-chevron-left')} aria-hidden />
            <span>{lang('Back')}</span>
          </Button>
          <span className={styles.headerTitle}>{lang('Safety Rules')}</span>
        </div>

        <SaferyRulesContent
          isActive={isActive}
          isFullSizeButton
          textFirst={lang('$safety_rules_one')}
          textSecond={lang('$safety_rules_two')}
          textThird={lang('$safety_rules_three')}
          isFirstCheckboxSelected={writedownAccepted}
          onFirstCheckboxClick={setWritedownAccepted}
          isSecondCheckboxSelected={openWalletAccepted}
          onSecondCheckboxClick={setOpenWalletAccepted}
          isThirdCheckboxSelected={canBeStolenAccepted}
          onThirdCheckboxClick={setCanBeStolenAccepted}
          onSubmit={openMnemonicPage}
        />
      </div>
    </div>
  );
};

export default memo(AuthSaferyRules);
