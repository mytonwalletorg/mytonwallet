import React, { memo } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import useHistoryBack from '../../hooks/useHistoryBack';

import TokenSelector from '../common/TokenSelector';
import SettingsTokenListHeader from './SettingsTokenListHeader';

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
  useHistoryBack({
    isActive,
    onBack: handleBackClick,
  });

  function renderHeader() {
    return (
      <SettingsTokenListHeader
        isInsideModal={isInsideModal}
        onBack={handleBackClick}
      />
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
