import React, { memo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { GlobalState } from '../../global/types';

import { ANIMATED_STICKER_SMALL_SIZE_PX } from '../../config';
import buildClassName from '../../util/buildClassName';
import { toDecimal } from '../../util/decimals';
import { ANIMATED_STICKERS_PATHS } from '../ui/helpers/animatedAssets';

import useHistoryBack from '../../hooks/useHistoryBack';
import useLang from '../../hooks/useLang';

import AmountWithFeeTextField from '../ui/AmountWithFeeTextField';
import AnimatedIconWithPreview from '../ui/AnimatedIconWithPreview';
import Button from '../ui/Button';
import IconWithTooltip from '../ui/IconWithTooltip';
import InteractiveTextField from '../ui/InteractiveTextField';
import ModalHeader from '../ui/ModalHeader';

import modalStyles from '../ui/Modal.module.scss';
import styles from './Transfer.module.scss';

interface OwnProps {
  isActive: boolean;
  savedAddresses?: Record<string, string>;
  symbol: string;
  decimals?: number;
  onBack: NoneToVoidFunction;
  onClose: NoneToVoidFunction;
}

interface StateProps {
  currentTransfer: GlobalState['currentTransfer'];
}

function TransferConfirm({
  currentTransfer: {
    amount,
    toAddress,
    resolvedAddress,
    fee,
    comment,
    shouldEncrypt,
    promiseId,
    isLoading,
    toAddressName,
    isToNewAddress,
  },
  symbol,
  decimals,
  isActive,
  savedAddresses,
  onBack,
  onClose,
}: OwnProps & StateProps) {
  const { submitTransferConfirm } = getActions();

  const lang = useLang();

  const addressName = savedAddresses?.[toAddress!] || toAddressName;

  useHistoryBack({
    isActive,
    onBack,
  });

  function renderComment() {
    if (!comment) {
      return undefined;
    }

    return (
      <>
        <div className={styles.label}>{shouldEncrypt ? lang('Encrypted Message') : lang('Comment or Memo')}</div>
        <div className={buildClassName(styles.inputReadOnly, styles.inputReadOnly_words, styles.commentInputWrapper)}>
          {comment}
        </div>
      </>
    );
  }

  return (
    <>
      <ModalHeader title={lang('Is it all ok?')} onClose={onClose} />
      <div className={modalStyles.transitionContent}>
        <AnimatedIconWithPreview
          size={ANIMATED_STICKER_SMALL_SIZE_PX}
          play={isActive}
          noLoop={false}
          nonInteractive
          className={buildClassName(styles.sticker, styles.sticker_sizeSmall)}
          tgsUrl={ANIMATED_STICKERS_PATHS.bill}
          previewUrl={ANIMATED_STICKERS_PATHS.billPreview}
        />
        <div className={styles.label}>
          {lang('Receiving Address')}

          {isToNewAddress && (
            <IconWithTooltip
              emoji="⚠️"
              message={lang('This address is new and never received transfers before.')}
              tooltipClassName={styles.warningTooltipContainer}
            />
          )}
        </div>
        <InteractiveTextField
          address={resolvedAddress!}
          addressName={addressName}
          copyNotification={lang('Address was copied!')}
          className={styles.addressWidget}
        />

        <AmountWithFeeTextField
          label={lang('Amount')}
          amount={toDecimal(amount ?? 0n, decimals)}
          symbol={symbol}
          fee={fee ? toDecimal(fee) : undefined}
        />

        {renderComment()}

        <div className={buildClassName(modalStyles.buttons, modalStyles.buttonsInsideContentWithScroll)}>
          {promiseId ? (
            <Button onClick={onClose} className={modalStyles.button}>{lang('Cancel')}</Button>
          ) : (
            <Button onClick={onBack} className={modalStyles.button}>{lang('Edit')}</Button>
          )}
          <Button
            isPrimary
            isLoading={isLoading}
            onClick={submitTransferConfirm}
            className={modalStyles.button}
          >
            {lang('Confirm')}
          </Button>
        </div>
      </div>
    </>
  );
}

export default memo(withGlobal<OwnProps>((global): StateProps => {
  return {
    currentTransfer: global.currentTransfer,
  };
})(TransferConfirm));
