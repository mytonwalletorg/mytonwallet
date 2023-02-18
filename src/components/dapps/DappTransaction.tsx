import React, { memo } from '../../lib/teact/teact';

import type { UserToken } from '../../global/types';
import type { ApiDappTransaction } from '../../api/types';

import buildClassName from '../../util/buildClassName';
import { bigStrToHuman } from '../../global/helpers';

import InteractiveTextField from '../ui/InteractiveTextField';
import AmountWithFeeTextField from '../ui/AmountWithFeeTextField';
import useLang from '../../hooks/useLang';
import useFlag from '../../hooks/useFlag';

import styles from './Dapp.module.scss';

interface OwnProps {
  tonToken: UserToken;
  transaction: ApiDappTransaction;
  fee?: string;
}

function DappTransaction({ tonToken, transaction, fee }: OwnProps) {
  const lang = useLang();
  const [isPayloadExpanded, expandPayload] = useFlag(false);

  return (
    <>
      <p className={styles.label}>{lang('Receiving Address')}</p>
      <InteractiveTextField
        address={transaction.toAddress}
        className={buildClassName(styles.dataField, styles.receivingAddress)}
        copyNotification={lang('Address was copied!')}
      />
      <AmountWithFeeTextField
        label={lang('Amount')}
        amount={bigStrToHuman(transaction.amount, tonToken.decimals)}
        symbol={tonToken.symbol}
        fee={fee ? bigStrToHuman(fee, tonToken.decimals) : undefined}
        className={styles.dataField}
      />

      {transaction.payload && (
        <>
          <p className={styles.label}>{lang('Payload')}</p>
          <div className={buildClassName(styles.payloadField, isPayloadExpanded && styles.payloadField_expanded)}>
            {transaction.payload}
            {!isPayloadExpanded && (
              <div className={styles.payloadFieldExpand} onClick={expandPayload}>
                {lang('View')}
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

export default memo(DappTransaction);
