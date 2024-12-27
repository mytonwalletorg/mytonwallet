import React, { memo } from '../../lib/teact/teact';
import { getActions } from '../../global';

import { ANIMATED_STICKER_MIDDLE_SIZE_PX } from '../../config';
import renderText from '../../global/helpers/renderText';
import buildClassName from '../../util/buildClassName';
import { ANIMATED_STICKERS_PATHS } from '../ui/helpers/animatedAssets';

import { useOpenFromMainBottomSheet } from '../../hooks/useDelegatedBottomSheet';
import useFlag from '../../hooks/useFlag';
import useHistoryBack from '../../hooks/useHistoryBack';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useShowTransition from '../../hooks/useShowTransition';

import AnimatedIconWithPreview from '../ui/AnimatedIconWithPreview';
import Button from '../ui/Button';
import Checkbox from '../ui/Checkbox';
import AuthBackupWarning from './AuthBackupWarning';

import styles from './Auth.module.scss';

interface OwnProps {
  isActive?: boolean;
  isImport?: boolean;
}

const AuthDisclaimer = ({
  isActive, isImport,
}: OwnProps) => {
  const {
    skipCheckMnemonic,
    confirmDisclaimer,
    cancelDisclaimer,
  } = getActions();

  const lang = useLang();
  const [isInformationConfirmed, markInformationConfirmed, unmarkInformationConfirmed] = useFlag(false);
  const {
    shouldRender: shouldRenderStartButton,
    transitionClassNames: startButtonTransitionClassNames,
  } = useShowTransition(isInformationConfirmed && isImport);

  useHistoryBack({
    isActive,
    onBack: cancelDisclaimer,
  });
  const setIsInformationConfirmed = useLastCallback((isConfirmed: boolean) => {
    if (isConfirmed) {
      markInformationConfirmed();
    } else {
      unmarkInformationConfirmed();
    }
  });

  useOpenFromMainBottomSheet('backup-warning', markInformationConfirmed);

  const handleCloseBackupWarningModal = useLastCallback(() => {
    setIsInformationConfirmed(false);
  });

  const handleSkipMnemonic = useLastCallback(() => {
    skipCheckMnemonic();
    handleCloseBackupWarningModal();
  });

  return (
    <div className={styles.wrapper}>
      <div className={buildClassName(styles.container, styles.container_scrollable, 'custom-scroll')}>
        <div className={styles.stickerAndTitle}>
          <AnimatedIconWithPreview
            play={isActive}
            tgsUrl={ANIMATED_STICKERS_PATHS.snitch}
            previewUrl={ANIMATED_STICKERS_PATHS.snitchPreview}
            noLoop={false}
            nonInteractive
            size={ANIMATED_STICKER_MIDDLE_SIZE_PX}
            className={styles.sticker}
          />
          <div className={styles.title}>{lang('Use Responsibly')}</div>
        </div>
        <div className={styles.infoBlock}>
          <p className={styles.text}>{renderText(lang('$auth_responsibly_description1'))}</p>
          <p className={styles.text}>{renderText(lang('$auth_responsibly_description2'))}</p>
          <p className={styles.text}>{renderText(lang('$auth_responsibly_description3'))}</p>
          <p className={styles.text}>{renderText(lang('$auth_responsibly_description4'))}</p>
        </div>

        <Checkbox
          id="information-confirmed"
          checked={isInformationConfirmed}
          onChange={setIsInformationConfirmed}
          className={styles.informationCheckbox}
          contentClassName={styles.informationCheckboxContent}
        >
          {lang('I have read and accept this information')}
        </Checkbox>
        {shouldRenderStartButton && (
          <div className={buildClassName(styles.buttons, startButtonTransitionClassNames)}>
            <Button isPrimary className={buildClassName(styles.btn, styles.btn_wide)} onClick={confirmDisclaimer}>
              {lang('Start Wallet')}
            </Button>
          </div>
        )}

        {!isImport && (
          <AuthBackupWarning
            isOpen={isInformationConfirmed}
            onClose={handleCloseBackupWarningModal}
            onSkip={handleSkipMnemonic}
          />
        )}
      </div>
    </div>
  );
};

export default memo(AuthDisclaimer);
