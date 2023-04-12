import React, { memo } from '../../lib/teact/teact';

import type { ApiDappTransaction, ApiParsedPayload } from '../../api/types';

import type { UserToken } from '../../global/types';
import { bigStrToHuman } from '../../global/helpers';
import buildClassName from '../../util/buildClassName';
import { formatCurrency } from '../../util/formatNumber';

import InteractiveTextField from '../ui/InteractiveTextField';
import AmountWithFeeTextField from '../ui/AmountWithFeeTextField';
import useLang from '../../hooks/useLang';
import useFlag from '../../hooks/useFlag';

import styles from './Dapp.module.scss';

interface OwnProps {
  tonToken: UserToken;
  transaction: ApiDappTransaction;
  fee?: string;
  tokens?: UserToken[];
}

const FRACTION_DIGITS = 2;

function DappTransaction({
  tonToken,
  transaction,
  fee,
  tokens,
}: OwnProps) {
  const lang = useLang();
  const [isPayloadExpanded, expandPayload] = useFlag(false);

  // eslint-disable-next-line consistent-return
  function renderPayload(payload: ApiParsedPayload) {
    switch (payload.type) {
      case 'comment':
        return payload.comment;

      case 'transfer-nft': {
        const { nftAddress, nftName, toAddress } = payload;
        return lang('$dapp_transfer_nft_payload', {
          nft: nftName ?? nftAddress,
          address: toAddress,
        });
      }

      case 'transfer-tokens': {
        const {
          slug: tokenSlug,
          amount: tokenAmount,
          comment,
          toAddress,
        } = payload;
        const token = tokens?.find(({ slug }) => slug === tokenSlug)!;
        if (comment) {
          return lang('$dapp_transfer_tokens_payload_with_comment', {
            amount: formatCurrency(bigStrToHuman(tokenAmount, token.decimals), token.symbol, FRACTION_DIGITS),
            address: toAddress,
            comment,
          });
        }

        return lang('$dapp_transfer_tokens_payload', {
          amount: formatCurrency(bigStrToHuman(tokenAmount, token.decimals), token.symbol, FRACTION_DIGITS),
          address: toAddress,
        });
      }

      case 'unknown':
        return payload.base64;
    }
  }

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
          <p className={styles.label}>{lang('Nested Transaction')}</p>
          <div className={buildClassName(styles.payloadField, isPayloadExpanded && styles.payloadField_expanded)}>
            {renderPayload(transaction.payload)}
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
