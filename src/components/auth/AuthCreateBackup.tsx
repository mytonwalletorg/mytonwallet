import React, { memo } from '../../lib/teact/teact';
import { getActions } from '../../global';

import { IS_PRODUCTION } from '../../config';
import renderText from '../../global/helpers/renderText';
import buildClassName from '../../util/buildClassName';
import { ANIMATED_STICKERS_PATHS } from '../ui/helpers/animatedAssets';

import useLang from '../../hooks/useLang';

import AnimatedIconWithPreview from '../ui/AnimatedIconWithPreview';
import Button from '../ui/Button';

import styles from './Auth.module.scss';

interface OwnProps {
  isActive?: boolean;
}

const AuthCreateBackup = ({ isActive }: OwnProps) => {
  const { skipCheckMnemonic, openAuthBackupWalletModal, resetAuth } = getActions();

  const lang = useLang();

  const canSkipMnemonicCheck = !IS_PRODUCTION;

  return (
    <div className={styles.wrapper}>
      <div className={buildClassName(styles.container, 'custom-scroll')}>
        <div className={styles.header}>
          <Button isSimple isText onClick={resetAuth} className={styles.headerBackBlock}>
            <i className={buildClassName(styles.iconChevron, 'icon-chevron-left')} aria-hidden />
            <span>{lang('Back')}</span>
          </Button>
          <span className={styles.headerTitle}> </span>
        </div>

        <AnimatedIconWithPreview
          play={isActive}
          tgsUrl={ANIMATED_STICKERS_PATHS.snitch}
          previewUrl={ANIMATED_STICKERS_PATHS.snitchPreview}
          noLoop={false}
          nonInteractive
          className={styles.sticker}
        />
        <div className={styles.title}>{lang('Create Backup')}</div>
        <div className={styles.info}>
          <p className={styles.info__space}>{renderText(lang('$auth_backup_description1'))}</p>
          <p>{renderText(lang('$auth_backup_description2'))}</p>
          <p>{renderText(lang('$auth_backup_description3'))}</p>
        </div>
        <div className={styles.buttons}>
          <Button
            isPrimary
            className={buildClassName(styles.btn, styles.btn_wide, !canSkipMnemonicCheck && styles.btn_single)}
            onClick={openAuthBackupWalletModal}
          >
            {lang('$back_up_auth')}
          </Button>
          {canSkipMnemonicCheck && (
            <Button
              isDestructive
              isText
              className={buildClassName(styles.btn, styles.btn_push)}
              onClick={skipCheckMnemonic}
            >
              {lang('Later')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(AuthCreateBackup);
