import React, { memo } from '../../lib/teact/teact';

import { TONCOIN } from '../../config';
import renderText from '../../global/helpers/renderText';
import { toDecimal } from '../../util/decimals';
import { formatCurrency } from '../../util/formatNumber';

import useLang from '../../hooks/useLang';

import Button from '../ui/Button';
import Modal from '../ui/Modal';

import modalStyles from '../ui/Modal.module.scss';
import styles from './Dapp.module.scss';

type OwnProps = {
  isOpen: boolean;
  onClose: NoneToVoidFunction;
  /** In TON */
  fullFee: bigint;
  /** In TON */
  received: bigint;
};

function DappReturnedDetailsModal({ isOpen, onClose, ...restProps }: OwnProps) {
  const lang = useLang();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      isCompact
      title={lang('Dapp Fee Details')}
      contentClassName={styles.detailsModalContent}
    >
      {/* eslint-disable-next-line react/jsx-props-no-spreading */}
      <FeeDetailsContent onClose={onClose} {...restProps} />
    </Modal>
  );
}

export default memo(DappReturnedDetailsModal);

function FeeDetailsContent({ onClose, fullFee, received }: Omit<OwnProps, 'isOpen'>) {
  const lang = useLang();

  return (
    <>
      <div className={styles.detailsModalExplanation}>
        <div>
          {renderText(lang('$dapp_return_details', {
            fee_amount: <b>{formatCurrency(toDecimal(fullFee, TONCOIN.decimals), TONCOIN.symbol, undefined, true)}</b>,
            // Rounding down to make the actual result better than we predict
            received_amount: <b>{'~ '}{formatCurrency(toDecimal(received, TONCOIN.decimals), TONCOIN.symbol)}</b>,
          }))}
        </div>
        <div className={styles.warningForPayload}>
          {lang('$dapp_return_disclaimer')}
        </div>
      </div>
      <div className={modalStyles.buttons}>
        <Button isPrimary className={modalStyles.button} onClick={onClose}>
          {lang('Got It')}
        </Button>
      </div>
    </>
  );
}
