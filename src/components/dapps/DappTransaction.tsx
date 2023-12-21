import React, { memo } from '../../lib/teact/teact';

import type { ApiDappTransaction, ApiParsedPayload } from '../../api/types';
import type { UserToken } from '../../global/types';

import { bigStrToHuman } from '../../global/helpers';
import buildClassName from '../../util/buildClassName';
import { formatCurrency } from '../../util/formatNumber';
import { DEFAULT_DECIMALS } from '../../api/blockchains/ton/constants';

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

  function renderPayload(payload: ApiParsedPayload, rawPayload?: string) {
    switch (payload.type) {
      case 'comment':
        return payload.comment;

      case 'nft:transfer': {
        const { nftAddress, nftName, newOwner } = payload;
        return lang('$dapp_transfer_nft_payload', {
          nft: nftName ?? nftAddress,
          address: newOwner,
        });
      }

      case 'tokens:transfer-non-standard':
      case 'tokens:transfer': {
        const {
          slug: tokenSlug,
          amount: tokenAmount,
          destination,
        } = payload;
        const token = tokens?.find(({ slug }) => slug === tokenSlug);
        const decimals = token?.decimals ?? DEFAULT_DECIMALS;
        const symbol = token?.symbol ?? '';

        return lang('$dapp_transfer_tokens_payload', {
          amount: formatCurrency(bigStrToHuman(tokenAmount, decimals), symbol, FRACTION_DIGITS),
          address: destination,
        });
      }

      case 'encrypted-comment':
        return payload.encryptedComment;

      default:
        return rawPayload;
    }
  }

  function renderPayloadLabel(payload: ApiParsedPayload) {
    switch (payload.type) {
      case 'comment':
        return lang('Comment');
      case 'tokens:transfer-non-standard':
      case 'tokens:transfer':
      case 'nft:transfer':
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
            {renderPayload(transaction.payload, transaction.rawPayload)}
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
