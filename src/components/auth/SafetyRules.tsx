import React, { memo, useCallback, useState } from '../../lib/teact/teact';

import { ANIMATED_STICKER_SMALL_SIZE_PX } from '../../config';
import { ANIMATED_STICKERS_PATHS } from '../ui/helpers/animatedAssets';
import renderText from '../../global/helpers/renderText';
import buildClassName from '../../util/buildClassName';
import useLang from '../../hooks/useLang';

import ModalHeader from '../ui/ModalHeader';
import Checkbox from '../ui/Checkbox';
import Button from '../ui/Button';
import AnimatedIconWithPreview from '../ui/AnimatedIconWithPreview';

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

  const handleSubmit = useCallback(() => {
    if (!canSubmit) {
      return;
    }

    onSubmit();
  }, [canSubmit, onSubmit]);

  return (
    <div className={modalStyles.transitionContentWrapper}>
      <ModalHeader title={lang('Safety Rules')} onClose={onClose} />
      <div className={buildClassName(modalStyles.transitionContent, 'custom-scroll')}>
        <AnimatedIconWithPreview
          tgsUrl={ANIMATED_STICKERS_PATHS.bill}
          previewUrl={ANIMATED_STICKERS_PATHS.billPreview}
          size={ANIMATED_STICKER_SMALL_SIZE_PX}
          play={isActive}
          nonInteractive
          noLoop={false}
          className={styles.modalSticker}
        />
        <Checkbox
          checked={writedownAccepted}
          onChange={setWritedownAccepted}
        >
          {renderText(lang('$safety_rules_one'))}
        </Checkbox>

        <Checkbox
          checked={openWalletAccepted}
          onChange={setOpenWalletAccepted}
        >
          {renderText(lang('$safety_rules_two'))}
        </Checkbox>

        <Checkbox
          checked={canBeStolenAccepted}
          onChange={setCanBeStolenAccepted}
        >
          {renderText(lang('$safety_rules_three'))}
        </Checkbox>

        <div className={modalStyles.buttons}>
          <Button isPrimary onClick={handleSubmit} isDisabled={!canSubmit}>{lang('Understood')}</Button>
        </div>
      </div>
    </div>
  );
}

export default memo(SafetyRules);
