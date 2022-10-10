import React, {
  memo, useCallback, useEffect, useMemo,
} from '../../lib/teact/teact';
import { UserToken } from '../../global/types';

import { getActions, withGlobal } from '../../global';
import { DEFAULT_PRICE_CURRENCY, TON_TOKEN_SLUG, TONSCAN_BASE_URL } from '../../config';
import { selectAllTokens } from '../../global/selectors';
import { formatCurrency, formatInteger } from '../../util/formatNumber';
import { copyTextToClipboard } from '../../util/clipboard';
import buildClassName from '../../util/buildClassName';
import { shortenAddress } from '../../util/shortenAddress';
import { round } from '../../util/round';
import { getTokenCardColor } from './helpers/card_colors';
import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';
import useShowTransition from '../../hooks/useShowTransition';
import captureEscKeyListener from '../../util/captureEscKeyListener';

import Loading from '../ui/Loading';
import TokenCard from './TokenCard';

import styles from './Card.module.scss';

interface OwnProps {
  onTokenCardClose: NoneToVoidFunction;
}

interface StateProps {
  address?: string;
  tokens?: UserToken[];
  currentTokenSlug?: string;
}

function Card({
  address,
  tokens,
  currentTokenSlug,
  onTokenCardClose,
}: OwnProps & StateProps) {
  const { showNotification } = getActions();

  const tonscanAddressUrl = `${TONSCAN_BASE_URL}address/${address}`;

  const currentToken = useMemo(() => {
    return tokens ? tokens.find((token) => token.slug === currentTokenSlug) : undefined;
  }, [currentTokenSlug, tokens]);
  const renderedToken = useCurrentOrPrev(currentToken, true);
  const {
    shouldRender: shouldRenderTokenCard,
    transitionClassNames: tokenCardTransitionClassNames,
  } = useShowTransition(Boolean(currentTokenSlug), undefined, true);
  const tokenCardColor = useMemo(() => {
    if (!renderedToken || renderedToken.slug === TON_TOKEN_SLUG) {
      return undefined;
    }

    return getTokenCardColor(renderedToken.slug);
  }, [renderedToken]);

  const values = useMemo(() => {
    return tokens ? buildValues(tokens) : undefined;
  }, [tokens]);

  useEffect(
    () => (shouldRenderTokenCard ? captureEscKeyListener(onTokenCardClose) : undefined),
    [shouldRenderTokenCard, onTokenCardClose],
  );

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

  const {
    primaryValue, primaryWholePart, primaryFractionPart, changeClassName, changePrefix, changePercent, changeValue,
  } = values;

  return (
    <div className={styles.containerWrapper}>
      <div className={buildClassName(styles.container, currentTokenSlug && styles.backstage)}>
        <div className={styles.primaryValue}>
          {DEFAULT_PRICE_CURRENCY}
          {primaryWholePart}
          {primaryFractionPart && <span className={styles.primaryFractionPart}>.{primaryFractionPart}</span>}
        </div>
        {primaryValue !== 0 && (
          <div className={buildClassName(styles.change, changeClassName)}>
            {changePrefix}
            &thinsp;
            {Math.abs(changePercent)}% · {formatCurrency(Math.abs(changeValue), DEFAULT_PRICE_CURRENCY)}
          </div>
        )}
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
      {shouldRenderTokenCard && (
        <TokenCard
          token={renderedToken!}
          classNames={tokenCardTransitionClassNames}
          color={tokenCardColor}
          onClose={onTokenCardClose}
        />
      )}
    </div>
  );
}

export default memo(withGlobal<OwnProps>((global): StateProps => {
  return {
    address: global.addresses?.byAccountId['0']!,
    tokens: selectAllTokens(global),
    currentTokenSlug: global.currentTokenSlug,
  };
})(Card));

function buildValues(tokens: UserToken[]) {
  const primaryValue = tokens.reduce((acc, token) => acc + token.amount * token.price, 0);
  const [primaryWholePart, primaryFractionPart] = formatInteger(primaryValue).split('.');
  const changeValue = round(tokens.reduce((acc, token) => acc + token.amount * token.price * token.change24h, 0), 4);
  const changePercent = round(primaryValue ? (changeValue / primaryValue) * 100 : 0, 2);
  const changeClassName = changePercent > 0
    ? styles.changeCourseUp
    : (changePercent < 0 ? styles.changeCourseDown : undefined);
  const changePrefix = changeValue > 0 ? '↑' : changeValue < 0 ? '↓' : undefined;

  return {
    primaryValue,
    primaryWholePart,
    primaryFractionPart,
    changeClassName,
    changePrefix,
    changePercent,
    changeValue,
  };
}
