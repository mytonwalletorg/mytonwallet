import React, { memo, useCallback, useState } from '../../lib/teact/teact';

import { ANIMATED_STICKER_SMALL_SIZE_PX } from '../../config';
import { ANIMATED_STICKERS_PATHS } from '../ui/helpers/animatedAssets';
import buildClassName from '../../util/buildClassName';

import ModalHeader from '../ui/ModalHeader';
import Checkbox from '../ui/Checkbox';
import Button from '../ui/Button';
import AnimatedIcon from '../ui/AnimatedIcon';

import modalStyles from '../ui/Modal.module.scss';
import styles from './Auth.module.scss';

type OwnProps = {
  isActive?: boolean;
  onSubmit: NoneToVoidFunction;
  onClose: NoneToVoidFunction;
};

function SafetyRules({ isActive, onSubmit, onClose }: OwnProps) {
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
      <ModalHeader title="Safety Rules" onClose={onClose} />
      <div className={buildClassName(modalStyles.transitionContent, 'custom-scroll')}>
        <AnimatedIcon
          tgsUrl={ANIMATED_STICKERS_PATHS.bill}
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
          On the next screen you will see the <strong>secret words</strong>.
          Write them down in the correct order and <strong>store in a secure place</strong>.
        </Checkbox>

        <Checkbox
          checked={openWalletAccepted}
          onChange={setOpenWalletAccepted}
        >
          They allow to <strong>open your wallet</strong> if you lose your password or access to this device.
        </Checkbox>

        <Checkbox
          checked={canBeStolenAccepted}
          onChange={setCanBeStolenAccepted}
        >
          If anybody else sees these words your funds <strong>may be stolen</strong>. Look around!
        </Checkbox>

        <div className={modalStyles.buttons}>
          <Button isPrimary onClick={handleSubmit} isDisabled={!canSubmit}>Understood</Button>
        </div>
      </div>
    </div>
  );
}

export default memo(SafetyRules);
