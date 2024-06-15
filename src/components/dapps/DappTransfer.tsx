import React, { memo } from '../../lib/teact/teact';

import type { ApiDappTransfer, ApiParsedPayload } from '../../api/types';
import type { UserToken } from '../../global/types';

import { TON_SYMBOL } from '../../config';
import buildClassName from '../../util/buildClassName';
import { toDecimal } from '../../util/decimals';
import { formatCurrency, formatCurrencySimple } from '../../util/formatNumber';
import { DEFAULT_DECIMALS, NFT_TRANSFER_TONCOIN_AMOUNT } from '../../api/blockchains/ton/constants';

import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';

import AmountWithFeeTextField from '../ui/AmountWithFeeTextField';
import InteractiveTextField from '../ui/InteractiveTextField';

import styles from './Dapp.module.scss';

interface OwnProps {
  tonToken: UserToken;
  transaction: ApiDappTransfer;
  fee?: bigint;
  tokens?: UserToken[];
}

const FRACTION_DIGITS = 2;

function DappTransfer({
  tonToken,
  transaction,
  fee,
  tokens,
}: OwnProps) {
  const lang = useLang();
  const [isPayloadExpanded, expandPayload] = useFlag(false);
  const isNftTransfer = transaction.payload?.type === 'nft:transfer';

  function renderFeeForNft() {
    return (
      <>
        <div className={styles.label}>{lang('Fee')}</div>
        <div className={styles.payloadField}>
          ≈ {formatCurrencySimple(NFT_TRANSFER_TONCOIN_AMOUNT + (fee ?? 0n), '')}
          <span className={styles.currencySymbol}>{TON_SYMBOL}</span>
        </div>
      </>
    );
  }

  function renderPayload(payload: ApiParsedPayload, rawPayload?: string) {
    switch (payload.type) {
      case 'comment':
        return payload.comment;

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
          amount: formatCurrency(toDecimal(tokenAmount, decimals), symbol, FRACTION_DIGITS),
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
        isScam={transaction.isScam}
        className={buildClassName(styles.dataField, styles.receivingAddress)}
        copyNotification={lang('Address was copied!')}
      />
      {isNftTransfer ? renderFeeForNft() : (
        <AmountWithFeeTextField
          label={lang('Amount')}
          amount={toDecimal(transaction.amount)}
          symbol={tonToken.symbol}
          fee={fee ? toDecimal(fee, tonToken.decimals) : undefined}
          className={styles.dataField}
          labelClassName={styles.label}
        />
      )}

      {transaction.payload && !isNftTransfer && (
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

export default memo(DappTransfer);
