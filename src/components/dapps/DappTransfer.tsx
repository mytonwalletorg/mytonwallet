import React, { memo } from '../../lib/teact/teact';

import type { ApiDappTransfer, ApiParsedPayload } from '../../api/types';
import type { UserToken } from '../../global/types';

import { TONCOIN } from '../../config';
import { BIGINT_PREFIX } from '../../util/bigint';
import buildClassName from '../../util/buildClassName';
import { toDecimal } from '../../util/decimals';
import { formatCurrency, formatCurrencySimple } from '../../util/formatNumber';
import { DEFAULT_DECIMALS, NFT_TRANSFER_AMOUNT } from '../../api/chains/ton/constants';

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
  const shouldRenderPayloadWarning = transaction.payload?.type === 'unknown';

  function renderFeeForNft() {
    return (
      <>
        <div className={styles.label}>{lang('Fee')}</div>
        <div className={styles.payloadField}>
          ≈ {formatCurrencySimple(NFT_TRANSFER_AMOUNT + (fee ?? 0n), '')}
          <span className={styles.currencySymbol}>{TONCOIN.symbol}</span>
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

      case 'tokens:burn': {
        const { slug: tokenSlug, amount } = payload;
        const token = tokens?.find(({ slug }) => slug === tokenSlug);
        const decimals = token?.decimals ?? DEFAULT_DECIMALS;
        const symbol = token?.symbol ?? '';

        return lang('$dapp_transfer_tokens_burn', {
          amount: formatCurrency(toDecimal(amount, decimals), symbol, FRACTION_DIGITS),
        });
      }

      case 'dns:change-record': {
        const { record } = payload;
        const category = record.type !== 'unknown' ? record.type : record.key;

        if (record.type === 'wallet' && record.value) {
          return lang('$dapp_dns_set_wallet_payload', {
            address: record.value,
          });
        } else if (record.type === 'wallet' && !record.value) {
          return lang('$dapp_dns_delete_wallet_payload');
        } else if (record.value) {
          return lang('$dapp_dns_change_record_payload', {
            category,
            value: record.value,
          });
        } else {
          return lang('$dapp_dns_delete_record_payload', {
            category,
          });
        }
      }

      case 'token-bridge:pay-swap': {
        return lang('$dapp_token_bridge_pay_swap_payload', {
          swapId: payload.swapId,
        });
      }

      case 'liquid-staking:deposit': {
        return lang('$dapp_liquid_staking_deposit_payload');
      }

      case 'liquid-staking:vote': {
        return lang('$dapp_liquid_staking_vote_payload', {
          votingAddress: payload.votingAddress,
          vote: payload.vote,
        });
      }

      case 'single-nominator:change-validator': {
        return lang('$dapp_single_nominator_change_validator_payload', {
          address: payload.address,
        });
      }

      case 'single-nominator:withdraw': {
        return lang('$dapp_single_nominator_withdraw_payload', {
          amount: toDecimal(payload.amount),
        });
      }

      case 'vesting:add-whitelist': {
        return lang('$dapp_vesting_add_whitelist_payload', {
          address: payload.address,
        });
      }

      case 'unknown': {
        return rawPayload;
      }

      default:
        return JSON.stringify(payload, undefined, 2)
          .replace(`/"${BIGINT_PREFIX}/g`, '"');
    }
  }

  function renderPayloadLabel(payload: ApiParsedPayload) {
    switch (payload.type) {
      case 'comment':
        return lang('Comment');
      case 'unknown':
        return lang('Payload');
      default:
        return lang('Nested Transaction');
    }
  }

  return (
    <>
      <p className={styles.label}>{lang('Receiving Address')}</p>
      <InteractiveTextField
        chain={tonToken.chain}
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
          feeText={fee ? formatCurrency(toDecimal(fee, tonToken.decimals), tonToken.symbol) : undefined}
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
          {shouldRenderPayloadWarning && (
            <div className={styles.warningForPayload}>{lang('$hardware_payload_warning')}</div>
          )}
        </>
      )}
    </>
  );
}

export default memo(DappTransfer);
