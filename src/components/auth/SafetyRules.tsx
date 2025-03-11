import React, { memo, useState } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import SafetyRulesContent from '../common/backup/SafetyRulesContent';
import ModalHeader from '../ui/ModalHeader';

import modalStyles from '../ui/Modal.module.scss';
import styles from './Auth.module.scss';

type OwnProps = {
  isActive?: boolean;
  onSubmit: NoneToVoidFunction;
  onClose: NoneToVoidFunction;
};

function SafetyRules({ isActive, onSubmit, onClose }: OwnProps) {
  const lang = useLang();
  const [writedownAccepted, setWritedownAccepted] = useState(false);
  const [openWalletAccepted, setOpenWalletAccepted] = useState(false);
  const [canBeStolenAccepted, setCanBeStolenAccepted] = useState(false);
  const canSubmit = writedownAccepted && openWalletAccepted && canBeStolenAccepted;

  const handleSubmit = useLastCallback(() => {
    if (!canSubmit) {
      return;
    }

    onSubmit();
  });

  return (
    <div className={modalStyles.transitionContentWrapper}>
      <ModalHeader title={lang('Safety Rules')} onClose={onClose} />
      <div className={buildClassName(modalStyles.transitionContent, 'custom-scroll')}>
        <SafetyRulesContent
          customStickerClassName={styles.modalSticker}
          customButtonWrapperClassName={modalStyles.buttons}
          isFullSizeButton={false}
          isActive={isActive}
          isFirstCheckboxSelected={writedownAccepted}
          isSecondCheckboxSelected={openWalletAccepted}
          isThirdCheckboxSelected={canBeStolenAccepted}
          textFirst={lang('$safety_rules_one')}
          textSecond={lang('$safety_rules_two')}
          textThird={lang('$safety_rules_three')}
          onFirstCheckboxClick={setWritedownAccepted}
          onSecondCheckboxClick={setOpenWalletAccepted}
          onThirdCheckboxClick={setCanBeStolenAccepted}
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  );
}

export default memo(SafetyRules);
