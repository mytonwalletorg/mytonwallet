import React, { memo } from '../../lib/teact/teact';

import type { FeePrecision, FeeTerms, FeeValue } from '../../util/fee/types';
import type { FeeToken } from '../ui/Fee';

import renderText from '../../global/helpers/renderText';
import buildClassName from '../../util/buildClassName';
import { getChainConfig } from '../../util/chain';
import { getChainBySlug } from '../../util/tokens';

import useLang from '../../hooks/useLang';

import Button from '../ui/Button';
import Fee from '../ui/Fee';
import Modal from '../ui/Modal';

import modalStyles from '../ui/Modal.module.scss';
import styles from './FeeDetailsModal.module.scss';

type OwnProps = {
  isOpen: boolean;
  onClose: NoneToVoidFunction;
  fullFee: FeeTerms | undefined;
  realFee: FeeTerms | undefined;
  realFeePrecision: FeePrecision | undefined;
  /** The excess fee is always measured in the native token */
  excessFee: FeeValue | undefined;
  excessFeePrecision: FeePrecision | undefined;
  /** The token denoting the `token` fields of the `FeeTerms` objects. */
  token: FeeToken | undefined;
};

function FeeDetailsModal({ isOpen, onClose, ...restProps }: OwnProps) {
  const lang = useLang();

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCompact title={lang('Blockchain Fee Details')}>
      {/* eslint-disable-next-line react/jsx-props-no-spreading */}
      <FeeDetailsContent onClose={onClose} {...restProps} />
    </Modal>
  );
}

export default memo(FeeDetailsModal);

function FeeDetailsContent({
  onClose,
  fullFee,
  realFee,
  realFeePrecision = 'exact',
  excessFee,
  excessFeePrecision = 'exact',
  token,
}: Omit<OwnProps, 'isOpen'>) {
  const chain = token && getChainBySlug(token.slug);
  const nativeToken = chain && getChainConfig(chain).nativeToken;
  const lang = useLang();

  return (
    <>
      <div className={styles.chart}>
        <div className={styles.chartLabels}>
          <div className={buildClassName(styles.chartLabel, styles.realFee)}>
            {lang('Final Fee')}
          </div>
          <div className={buildClassName(styles.chartLabel, styles.excessFee)}>
            {lang('Excess')}
          </div>
        </div>
        <div className={styles.chartLines}>
          <div className={buildClassName(styles.chartLine, styles.realFee)}>
            {realFee && token && (
              <Fee
                terms={realFee}
                precision={realFeePrecision}
                token={token}
                shouldPreferIcons
              />
            )}
          </div>
          <div className={buildClassName(styles.chartLine, styles.excessFee)}>
            {excessFee !== undefined && token && (
              <Fee
                terms={{ native: excessFee }}
                precision={excessFeePrecision}
                token={token}
                shouldPreferIcons
              />
            )}
          </div>
        </div>
      </div>
      <div className={styles.explanation}>
        <p className={styles.explanationBlock}>
          {renderText(lang('$fee_details', {
            full_fee: fullFee && token && <b><Fee terms={fullFee} precision="exact" token={token} /></b>,
            excess_symbol: <b>{nativeToken?.symbol}</b>,
          }))}
        </p>
        <p className={styles.explanationBlock}>
          {lang('This is how the %chain_name% Blockchain works.', {
            chain_name: chain?.toUpperCase(),
          })}
        </p>
      </div>
      <div className={modalStyles.buttons}>
        <Button isPrimary className={modalStyles.button} onClick={onClose}>
          {lang('Got It')}
        </Button>
      </div>
    </>
  );
}
