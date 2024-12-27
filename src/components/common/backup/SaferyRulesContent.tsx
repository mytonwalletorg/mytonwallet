import React, { memo } from '../../../lib/teact/teact';

import { ANIMATED_STICKER_MIDDLE_SIZE_PX } from '../../../config';
import renderText from '../../../global/helpers/renderText';
import { ANIMATED_STICKERS_PATHS } from '../../ui/helpers/animatedAssets';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import AnimatedIconWithPreview from '../../ui/AnimatedIconWithPreview';
import Button from '../../ui/Button';
import Checkbox from '../../ui/Checkbox';

import styles from './BackUpContent.module.scss';

interface OwnProps {
  customStickerClassName?: string;
  customButtonWrapperClassName?: string;
  isFullSizeButton?: boolean;
  isActive?: boolean;
  isFirstCheckboxSelected: boolean;
  isSecondCheckboxSelected: boolean;
  isThirdCheckboxSelected: boolean;
  onFirstCheckboxClick: AnyFunction;
  onSecondCheckboxClick: AnyFunction;
  onThirdCheckboxClick: AnyFunction;
  textFirst: string;
  textSecond: string;
  textThird: string;
  onSubmit: () => void;
}

function SaferyRulesContent({
  customStickerClassName,
  customButtonWrapperClassName,
  isFullSizeButton,
  isActive,
  isFirstCheckboxSelected,
  isSecondCheckboxSelected,
  isThirdCheckboxSelected,
  textFirst,
  textSecond,
  textThird,
  onFirstCheckboxClick,
  onSecondCheckboxClick,
  onThirdCheckboxClick,
  onSubmit,
}: OwnProps) {
  const lang = useLang();

  const canSubmit = isFirstCheckboxSelected && isSecondCheckboxSelected && isThirdCheckboxSelected;

  const handleSubmit = useLastCallback(() => {
    if (!canSubmit) {
      return;
    }

    onSubmit();
  });

  return (
    <>
      <AnimatedIconWithPreview
        tgsUrl={ANIMATED_STICKERS_PATHS.bill}
        previewUrl={ANIMATED_STICKERS_PATHS.billPreview}
        size={ANIMATED_STICKER_MIDDLE_SIZE_PX}
        play={isActive}
        nonInteractive
        noLoop={false}
        className={customStickerClassName || styles.modalSticker}
      />
      <Checkbox
        checked={isFirstCheckboxSelected}
        onChange={onFirstCheckboxClick}
      >
        {renderText(textFirst)}
      </Checkbox>

      <Checkbox
        checked={isSecondCheckboxSelected}
        onChange={onSecondCheckboxClick}
      >
        {renderText(textSecond)}
      </Checkbox>

      <Checkbox
        checked={isThirdCheckboxSelected}
        onChange={onThirdCheckboxClick}
      >
        {renderText(textThird)}
      </Checkbox>

      <div className={customButtonWrapperClassName || styles.buttonWrapper}>
        <Button
          isPrimary
          isDisabled={!canSubmit}
          className={isFullSizeButton ? styles.footerButton : undefined}
          onClick={handleSubmit}
        >
          {lang('Understood')}
        </Button>
      </div>
    </>
  );
}

export default memo(SaferyRulesContent);
