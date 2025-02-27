import React, { memo } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import useLang from '../../hooks/useLang';

import Button from '../ui/Button';

import styles from './Settings.module.scss';

interface OwnProps {
  isInsideModal?: boolean;
  onBack: NoneToVoidFunction;
}

function SettingsTokenListHeader({
  isInsideModal,
  onBack,
}: OwnProps) {
  const lang = useLang();

  if (isInsideModal) return undefined;

  return (
    <div className={styles.header}>
      <Button isSimple isText onClick={onBack} className={styles.headerBack}>
        <i className={buildClassName(styles.iconChevron, 'icon-chevron-left')} aria-hidden />
        <span>{lang('Back')}</span>
      </Button>
      <span className={styles.headerTitle}>{lang('Select Token')}</span>
    </div>
  );
}

export default memo(SettingsTokenListHeader);
