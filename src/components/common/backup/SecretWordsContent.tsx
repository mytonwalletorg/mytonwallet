import React, { memo } from '../../../lib/teact/teact';

import { ANIMATED_STICKER_MIDDLE_SIZE_PX } from '../../../config';
import { ANIMATED_STICKERS_PATHS } from '../../ui/helpers/animatedAssets';

import AnimatedIconWithPreview from '../../ui/AnimatedIconWithPreview';
import Button from '../../ui/Button';
import SecretWordsList from './SecretWordsList';

import styles from './BackUpContent.module.scss';

interface OwnProps {
  isActive?: boolean;
  mnemonic?: string[];
  onSubmit: () => void;
  buttonText: string;
}

function SecretWordsContent({
  isActive,
  mnemonic,
  onSubmit,
  buttonText,
}: OwnProps) {
  return (
    <>
      <AnimatedIconWithPreview
        tgsUrl={ANIMATED_STICKERS_PATHS.bill}
        previewUrl={ANIMATED_STICKERS_PATHS.billPreview}
        size={ANIMATED_STICKER_MIDDLE_SIZE_PX}
        play={isActive}
        nonInteractive
        noLoop={false}
        className={styles.modalSticker}
      />
      <SecretWordsList mnemonic={mnemonic} />
      <div className={styles.buttonWrapper}>
        <Button
          isPrimary
          onClick={onSubmit}
          className={styles.footerButton}
        >
          {buttonText}
        </Button>
      </div>
    </>
  );
}

export default memo(SecretWordsContent);
