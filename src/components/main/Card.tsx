import React, { memo, useCallback, useMemo } from '../../lib/teact/teact';
import { UserToken } from '../../global/types';

import { getActions, withGlobal } from '../../global';
import { CARD_SECONDARY_VALUE_SYMBOL, DEFAULT_PRICE_CURRENCY } from '../../config';
import { selectAllTokens } from '../../global/selectors';
import { formatCurrencyExtended, formatInteger } from '../../util/formatNumber';
import { copyTextToClipboard } from '../../util/clipboard';
import buildClassName from '../../util/buildClassName';
import { shortenAddress } from '../../util/shortenAddress';

import Loading from '../ui/Loading';

import styles from './Card.module.scss';

interface StateProps {
  address?: string;
  tokens?: UserToken[];
}

function Card({
  address,
  tokens,
}: StateProps) {
  const { showNotification } = getActions();
  const tonscanAddressUrl = `https://tonscan.org/address/${address}`;

  const values = useMemo(() => {
    return tokens ? buildValues(tokens) : undefined;
  }, [tokens]);

  const handleCopyAddress = useCallback(() => {
    if (!address) return;

    showNotification({ message: 'Address was copied!', icon: 'icon-copy' });
    copyTextToClipboard(address);
  }, [address, showNotification]);

  if (!values) {
    return (
      <div className={styles.containerWrapper}>
        <div className={buildClassName(styles.container, styles.isLoading)}>
          <Loading color="white" />
        </div>
      </div>
    );
  }

  const { secondaryValue, primaryWholePart, primaryFractionPart } = values;

  return (
    <div className={styles.containerWrapper}>
      <div className={styles.container}>
        <div className={styles.secondaryValue}>
          {formatCurrencyExtended(secondaryValue, CARD_SECONDARY_VALUE_SYMBOL, true)}
        </div>
        <div className={styles.primaryValue}>
          {DEFAULT_PRICE_CURRENCY}
          {primaryWholePart}
          {primaryFractionPart && <span className={styles.primaryFractionPart}>.{primaryFractionPart}</span>}
        </div>
        <div className={styles.addressContainer}>
          <button type="button" className={styles.address} aria-label="Copy wallet address" onClick={handleCopyAddress}>
            {address && shortenAddress(address)}
            <i className={buildClassName(styles.icon, 'icon-copy')} aria-hidden />
          </button>
          <a
            href={tonscanAddressUrl}
            className={styles.tonscanButton}
            title="View address on TON Explorer"
            target="_blank"
            rel="noreferrer noopener"
          >
            <i className={buildClassName(styles.icon, 'icon-tonscan')} aria-hidden />
          </a>
        </div>
      </div>
    </div>
  );
}

function buildValues(tokens: UserToken[]) {
  const primaryValue = tokens.reduce((acc, token) => acc + token.amount * token.price, 0);
  const [primaryWholePart, primaryFractionPart] = formatInteger(primaryValue).split('.');
  const secondaryFactor = tokens.find((token) => token.symbol === CARD_SECONDARY_VALUE_SYMBOL)!.price;
  const secondaryValue = primaryValue / secondaryFactor;

  return {
    secondaryValue, primaryWholePart, primaryFractionPart,
  };
}

export default memo(withGlobal((global): StateProps => {
  return {
    address: global.addresses?.byAccountId['0']!,
    tokens: selectAllTokens(global),
  };
})(Card));
