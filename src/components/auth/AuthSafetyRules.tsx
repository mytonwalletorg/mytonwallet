import React, { memo, useState } from '../../lib/teact/teact';
import { getActions } from '../../global';

import buildClassName from '../../util/buildClassName';

import useHistoryBack from '../../hooks/useHistoryBack';
import useLang from '../../hooks/useLang';

import SafetyRulesContent from '../common/backup/SafetyRulesContent';
import Button from '../ui/Button';

import styles from './Auth.module.scss';

interface OwnProps {
  isActive?: boolean;
}

const AuthSafetyRules = ({ isActive }: OwnProps) => {
  const { openCreateBackUpPage, openMnemonicPage } = getActions();

  const [firstChecked, setFirstChecked] = useState(false);
  const [secondChecked, setSecondChecked] = useState(false);
  const [thirdChecked, setThirdChecked] = useState(false);

  useHistoryBack({ isActive, onBack: openCreateBackUpPage });

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

        <SafetyRulesContent
          isActive={isActive}
          isFullSizeButton
          textFirst={lang('$safety_rules_one')}
          textSecond={lang('$safety_rules_two')}
          textThird={lang('$safety_rules_three')}
          isFirstCheckboxSelected={firstChecked}
          onFirstCheckboxClick={setFirstChecked}
          isSecondCheckboxSelected={secondChecked}
          onSecondCheckboxClick={setSecondChecked}
          isThirdCheckboxSelected={thirdChecked}
          onThirdCheckboxClick={setThirdChecked}
          onSubmit={openMnemonicPage}
        />
      </div>
    </div>
  );
};

export default memo(AuthSafetyRules);
