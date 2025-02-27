import React, { memo, type TeactNode } from '../../lib/teact/teact';

import { TONCOIN } from '../../config';
import { toDecimal } from '../../util/decimals';
import { formatCurrency } from '../../util/formatNumber';

import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';

import FeeDetailsModal from '../common/FeeDetailsModal';
import FeeLine from '../ui/FeeLine';

import styles from './Dapp.module.scss';

interface OwnProps {
  realFee?: bigint;
  fullFee: bigint;
  /**
   * The amount to be received as a result of the transaction(s). Undefined means that the received amount is unknown
   * because the emulation failed
   */
  received?: bigint;
}

function DappTransferFee({
  realFee, fullFee, received,
}: OwnProps) {
  const lang = useLang();
  const [isDetailsModalOpen, openDetailsModal, closeDetailsModal] = useFlag();

  const realFeeTerms = { native: realFee };
  const fullFeeTerms = { native: fullFee };
  const realFeePrecision = 'approximate';
  const excessFee = fullFee - (realFee ?? 0n);

  const content: TeactNode[] = [];

  if (realFee !== undefined) {
    content.push(
      <FeeLine terms={realFeeTerms} token={TONCOIN} precision={realFeePrecision} onDetailsClick={openDetailsModal} />,
    );
  } else if (received) {
    content.push(
      <div>
        {lang('$returned_value', {
          // Rounding down to make the actual result better than we predict
          value: formatCurrency(toDecimal(received, TONCOIN.decimals), TONCOIN.symbol),
        })}
      </div>,
    );
  } else {
    content.push(
      <FeeLine terms={fullFeeTerms} token={TONCOIN} precision={received === undefined ? 'lessThan' : 'exact'} />,
    );
  }

  content.push(
    <FeeDetailsModal
      isOpen={isDetailsModalOpen}
      onClose={closeDetailsModal}
      fullFee={fullFeeTerms}
      realFee={realFeeTerms}
      realFeePrecision={realFeePrecision}
      excessFee={excessFee}
      excessFeePrecision="approximate"
      token={TONCOIN}
    />,
  );

  return <div className={styles.fee}>{content}</div>;
}

export default memo(DappTransferFee);
