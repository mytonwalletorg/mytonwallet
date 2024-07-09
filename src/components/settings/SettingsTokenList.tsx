import React, { memo } from '../../lib/teact/teact';

import useHistoryBack from '../../hooks/useHistoryBack';

import TokenSelector from '../common/TokenSelector';

import styles from './Settings.module.scss';

interface OwnProps {
  isActive?: boolean;
  handleBackClick: NoneToVoidFunction;
}

function SettingsTokenList({
  isActive,
  handleBackClick,
}: OwnProps) {
  useHistoryBack({
    isActive,
    onBack: handleBackClick,
  });

  return (
    <div className={styles.slide}>
      <TokenSelector
        isActive={isActive}
        onBack={handleBackClick}
        onClose={handleBackClick}
        isInsideSettings
        shouldHideMyTokens
      />
    </div>
  );
}

export default memo(SettingsTokenList);
