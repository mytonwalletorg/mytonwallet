import type { TeactNode } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';
import { withGlobal } from '../../global';

import type { ApiBaseCurrency, ApiTokenWithPrice } from '../../api/types';

import { toBig, toDecimal } from '../../util/decimals';
import { formatCurrency, getShortCurrencySymbol } from '../../util/formatNumber';

import styles from './Dapp.module.scss';

type OwnProps = {
  label: TeactNode;
  amountsBySlug: Record<string, bigint>;
};

type StateProps = {
  tokensBySlug: Record<string, ApiTokenWithPrice>;
  baseCurrency?: ApiBaseCurrency;
};

function DappAmountField({
  label,
  amountsBySlug,
  tokensBySlug,
  baseCurrency,
}: OwnProps & StateProps) {
  const totalCost = getTotalCost(amountsBySlug, tokensBySlug);
  const amountTerms: TeactNode[] = [];

  Object.entries(amountsBySlug).forEach(([tokenSlug, amount], index) => {
    if (index > 0) {
      amountTerms.push(' + ');
    }

    const token = tokensBySlug[tokenSlug];

    amountTerms.push(
      <span className={styles.payloadFieldTerm}>
        {formatCurrency(toDecimal(amount, token?.decimals ?? 0), token?.symbol ?? '')}
      </span>,
    );
  });

  return (
    <>
      <span className={styles.label}>
        {label}
      </span>
      <div className={styles.payloadField}>
        {amountTerms}
        {' '}
        ({formatCurrency(totalCost, getShortCurrencySymbol(baseCurrency))})
      </div>
    </>
  );
}

export default memo(withGlobal<OwnProps>((global): StateProps => {
  return {
    tokensBySlug: global.tokenInfo.bySlug,
    baseCurrency: global.settings.baseCurrency,
  };
})(DappAmountField));

function getTotalCost(amountsBySlug: Record<string, bigint>, tokensBySlug: Record<string, ApiTokenWithPrice>) {
  return Object.entries(amountsBySlug).reduce((sum, [tokenSlug, amount]) => {
    const token = tokensBySlug[tokenSlug];
    if (!token) {
      return sum;
    }
    return sum + toBig(amount, token.decimals).toNumber() * token.quote.price;
  }, 0);
}
