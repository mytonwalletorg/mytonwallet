import React, { memo } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import useHistoryBack from '../../hooks/useHistoryBack';
import useLang from '../../hooks/useLang';

import TokenSelector from '../common/TokenSelector';
import Button from '../ui/Button';

import styles from './Settings.module.scss';

interface OwnProps {
  isActive?: boolean;
  isInsideModal?: boolean;
  handleBackClick: NoneToVoidFunction;
}

function SettingsTokenList({
  isActive,
  isInsideModal,
  handleBackClick,
}: OwnProps) {
  const lang = useLang();

  useHistoryBack({
    isActive,
    onBack: handleBackClick,
  });

  function renderHeader() {
    return (
      <div className={buildClassName(styles.header, isInsideModal && styles.headerInsideModal)}>
        <Button
          isSimple
          isText
          className={buildClassName(styles.headerBack, isInsideModal && styles.isInsideModal)}
          onClick={handleBackClick}
        >
          <i className={buildClassName(styles.iconChevron, 'icon-chevron-left')} aria-hidden />
          <span>{lang('Back')}</span>
        </Button>
        <span className={styles.headerTitle}>{lang('Select Token')}</span>
      </div>
    );
  }

  return (
    <div className={buildClassName(styles.slide, styles.withTopSpace)}>
      <TokenSelector
        isActive={isActive}
        isInsideSettings
        shouldHideMyTokens
        shouldHideNotSupportedTokens
        header={renderHeader()}
        onBack={handleBackClick}
        onClose={handleBackClick}
      />
    </div>
  );
}

export default memo(SettingsTokenList);
