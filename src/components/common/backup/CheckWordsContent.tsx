import React, { memo } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import { ANIMATED_STICKER_MIDDLE_SIZE_PX } from '../../../config';
import renderText from '../../../global/helpers/renderText';
import buildClassName from '../../../util/buildClassName';
import { ANIMATED_STICKERS_PATHS } from '../../ui/helpers/animatedAssets';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import AnimatedIconWithPreview from '../../ui/AnimatedIconWithPreview';
import Button from '../../ui/Button';
import CheckWordsForm from './CheckWordsForm';

import styles from './BackUpContent.module.scss';

interface OwnProps {
  isActive?: boolean;
  checkIndexes?: number[];
  mnemonic?: string[];
}

function CheckWordsContent({
  isActive,
  checkIndexes,
  mnemonic,
}: OwnProps) {
  const { closeCheckWordsPage } = getActions();

  const onSubmit = useLastCallback(() => {
    closeCheckWordsPage({ isBackupCreated: true });
  });

  const lang = useLang();

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
      <p className={buildClassName(styles.info, styles.small)}>
        {renderText(lang('$check_words_description'))}
      </p>

      <CheckWordsForm
        descriptionClassName={buildClassName(styles.info, styles.small)}
        formClassName={styles.checkMnemonicForm}
        isActive={isActive}
        mnemonic={mnemonic}
        checkIndexes={checkIndexes}
        errorClassName={styles.error}
        onSubmit={onSubmit}
      />

      <div className={styles.buttonWrapper}>
        <Button
          isPrimary
          forFormId="check_mnemonic_form"
          className={styles.footerButton}
        >
          {lang('Continue')}
        </Button>
      </div>
    </>
  );
}

export default memo(CheckWordsContent);
