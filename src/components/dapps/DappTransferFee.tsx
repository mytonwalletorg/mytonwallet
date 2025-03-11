import React, { memo } from '../../lib/teact/teact';

import type { ApiDappTransfer } from '../../api/types';

import { TONCOIN } from '../../config';
import { toDecimal } from '../../util/decimals';
import { formatCurrency } from '../../util/formatNumber';

import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';

import FeeDetailsModal from '../common/FeeDetailsModal';
import FeeLine, { FeeLineContainer } from '../ui/FeeLine';
import DappReturnedDetailsModal from './DappReturnedDetailsModal';

import styles from './Dapp.module.scss';

type OwnProps = Pick<ApiDappTransfer, 'fullFee' | 'received'>;

function DappTransferFee({
  fullFee, received,
}: OwnProps) {
  const lang = useLang();
  const [isDetailsModalOpen, openDetailsModal, closeDetailsModal] = useFlag();

  if (received === 0n) {
    return (
      <FeeLine
        terms={{ native: fullFee }}
        token={TONCOIN}
        precision="exact"
        className={styles.fee}
      />
    );
  }

  if (fullFee >= received) {
    const realFee = fullFee - received;
    const realFeePrecision = 'approximate';
    return (
      <>
        <FeeLine
          terms={{ native: realFee }}
          token={TONCOIN}
          precision="approximate"
          onDetailsClick={openDetailsModal}
          className={styles.fee}
        />
        <FeeDetailsModal
          isOpen={isDetailsModalOpen}
          onClose={closeDetailsModal}
          fullFee={{ native: fullFee }}
          realFee={{ native: realFee }}
          realFeePrecision={realFeePrecision}
          excessFee={received}
          excessFeePrecision="approximate"
          token={TONCOIN}
          title={lang('Dapp Fee Details')}
          extraContent={<div className={styles.explanationWarning}>{lang('$dapp_return_disclaimer')}</div>}
        />
      </>
    );
  }

  const realReceived = received - fullFee;
  return (
    <>
      <FeeLineContainer className={styles.fee} onDetailsClick={openDetailsModal}>
        {lang('$returned_value', {
          // Rounding down to make the actual result better than we predict
          value: formatCurrency(toDecimal(realReceived, TONCOIN.decimals), TONCOIN.symbol),
        })}
      </FeeLineContainer>
      <DappReturnedDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={closeDetailsModal}
        fullFee={fullFee}
        received={received}
      />
    </>
  );
}

export default memo(DappTransferFee);
