import React, { memo } from '../../lib/teact/teact';

import type { ApiToken } from '../../api/types';
import type { ExtendedDappTransfer } from '../../global/types';

import { TONCOIN } from '../../config';
import { BIGINT_PREFIX } from '../../util/bigint';
import buildClassName from '../../util/buildClassName';
import { toDecimal } from '../../util/decimals';
import { formatCurrency } from '../../util/formatNumber';
import {
  doesTransactionAmountActAsFee,
  getDappTransferActualToAddress,
  isNftTransferPayload,
  isTokenTransferPayload,
} from '../../util/ton/transfer';
import { DEFAULT_DECIMALS } from '../../api/chains/ton/constants';

import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';

import NftInfo from '../transfer/NftInfo';
import AmountWithFeeTextField from '../ui/AmountWithFeeTextField';
import InteractiveTextField from '../ui/InteractiveTextField';
import DappTransferFee from './DappTransferFee';

import styles from './Dapp.module.scss';

interface OwnProps {
  transaction: ExtendedDappTransfer;
  tokensBySlug: Record<string, ApiToken>;
}

const FRACTION_DIGITS = 2;

function DappTransfer({ transaction, tokensBySlug }: OwnProps) {
  const lang = useLang();
  const [isPayloadExpanded, expandPayload] = useFlag(false);

  function renderAmount() {
    if (isNftTransferPayload(transaction.payload)) {
      return undefined;
    }

    let token: ApiToken | undefined = TONCOIN;
    let amount = transaction.amount;

    if (isTokenTransferPayload(transaction.payload)) {
      token = tokensBySlug[transaction.payload.slug];
      amount = transaction.payload.amount;
    }

    return (
      <AmountWithFeeTextField
        label={lang('Amount')}
        amount={toDecimal(amount, token?.decimals ?? DEFAULT_DECIMALS)}
        symbol={token?.symbol ?? ''}
        className={styles.dataField}
        labelClassName={styles.label}
      />
    );
  }

  function renderFee() {
    let fullFee = transaction.emulation?.networkFee ?? transaction.networkFee ?? 0n;

    if (doesTransactionAmountActAsFee(transaction.payload)) {
      fullFee += transaction.amount;
    }

    return (
      <DappTransferFee
        realFee={transaction.emulation?.realFee}
        fullFee={fullFee}
        received={transaction.emulation?.received}
      />
    );
  }

  function renderPayload() {
    const { payload, rawPayload } = transaction;

    if (!payload || isNftTransferPayload(payload) || isTokenTransferPayload(payload)) {
      return undefined;
    }

    switch (payload.type) {
      case 'comment':
        return payload.comment;

      case 'tokens:burn': {
        const { slug: tokenSlug, amount } = payload;
        const token = tokensBySlug[tokenSlug];
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

  function renderPayloadLabel() {
    switch (transaction.payload?.type) {
      case 'comment':
        return lang('Comment');
      case 'unknown':
        return lang('Payload');
      default:
        return lang('Nested Transaction');
    }
  }

  const payloadElement = renderPayload();

  return (
    <>
      {isNftTransferPayload(transaction.payload) && <NftInfo nft={transaction.payload.nft} />}
      <p className={styles.label}>{lang('Receiving Address')}</p>
      <InteractiveTextField
        chain={TONCOIN.chain}
        address={getDappTransferActualToAddress(transaction)}
        isScam={transaction.isScam}
        className={buildClassName(styles.dataField, styles.receivingAddress)}
        copyNotification={lang('Address was copied!')}
      />
      {renderAmount()}

      {payloadElement && (
        <>
          <p className={styles.label}>{renderPayloadLabel()}</p>
          <div className={buildClassName(styles.payloadField, isPayloadExpanded && styles.payloadField_expanded)}>
            {payloadElement}
            {!isPayloadExpanded && (
              <div className={styles.payloadFieldExpand} onClick={expandPayload}>
                {lang('View')}
              </div>
            )}
          </div>
          {transaction.isDangerous && (
            <div className={styles.warningForPayload}>{lang('$hardware_payload_warning')}</div>
          )}
        </>
      )}

      {renderFee()}
    </>
  );
}

export default memo(DappTransfer);
