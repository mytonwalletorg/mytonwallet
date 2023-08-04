import React, { memo } from '../../lib/teact/teact';

import type { ApiDappTransaction, ApiParsedPayload } from '../../api/types';
import type { UserToken } from '../../global/types';

import { bigStrToHuman } from '../../global/helpers';
import buildClassName from '../../util/buildClassName';
import { formatCurrency } from '../../util/formatNumber';

import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';

import AmountWithFeeTextField from '../ui/AmountWithFeeTextField';
import InteractiveTextField from '../ui/InteractiveTextField';

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

  function renderPayload(payload: ApiParsedPayload) {
    switch (payload.type) {
      case 'comment':
        return payload.comment;

      case 'transfer-nft': {
        const { nftAddress, nftName, newOwner } = payload;
        return lang('$dapp_transfer_nft_payload', {
          nft: nftName ?? nftAddress,
          address: newOwner,
        });
      }

      case 'transfer-tokens:non-standard':
      case 'transfer-tokens': {
        const {
          slug: tokenSlug,
          amount: tokenAmount,
          destination,
        } = payload;
        const token = tokens?.find(({ slug }) => slug === tokenSlug)!;

        return lang('$dapp_transfer_tokens_payload', {
          amount: formatCurrency(bigStrToHuman(tokenAmount, token.decimals), token.symbol, FRACTION_DIGITS),
          address: destination,
        });
      }

      case 'encrypted-comment':
        return payload.encryptedComment;

      default:
        return payload.base64;
    }
  }

  function renderPayloadLabel(payload: ApiParsedPayload) {
    switch (payload.type) {
      case 'comment':
        return lang('Comment');
      case 'transfer-tokens:non-standard':
      case 'transfer-tokens':
      case 'transfer-nft':
      case 'encrypted-comment':
        return lang('Nested Transaction');
      default:
        return lang('Payload');
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
          <p className={styles.label}>{renderPayloadLabel(transaction.payload)}</p>
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
