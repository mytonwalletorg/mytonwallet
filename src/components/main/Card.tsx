import React, {
  memo, useCallback, useEffect, useMemo,
} from '../../lib/teact/teact';
import { UserToken } from '../../global/types';

import { getActions, withGlobal } from '../../global';
import { DEFAULT_PRICE_CURRENCY, TON_TOKEN_SLUG, TONSCAN_BASE_URL } from '../../config';
import { ASSET_LOGO_PATHS } from '../ui/helpers/assetLogos';
import { selectAllTokens } from '../../global/selectors';
import { formatCurrency, formatInteger } from '../../util/formatNumber';
import { copyTextToClipboard } from '../../util/clipboard';
import buildClassName from '../../util/buildClassName';
import { shortenAddress } from '../../util/shortenAddress';
import { round } from '../../util/round';
import { formatFullDay } from '../../util/dateFormat';
import { getTokenCardColor } from './helpers/card_colors';
import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';
import useShowTransition from '../../hooks/useShowTransition';
import captureEscKeyListener from '../../util/captureEscKeyListener';

import Loading from '../ui/Loading';
import TokenPriceChart from '../ui/TokenPriceChart';
import Button from '../ui/Button';

import styles from './Card.module.scss';

import tonUrl from '../../assets/coins/ton.svg';

interface OwnProps {
  onTokenCardClose: NoneToVoidFunction;
}

interface StateProps {
  address?: string;
  tokens?: UserToken[];
  currentTokenSlug?: string;
}

const COIN_MARKET_CAP_TOKENS: Record<string, string> = {
  toncoin: 'toncoin',
  'ton-tgr': 'tgr',
};

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
      {shouldRenderTokenCard && renderTokenCard(
        renderedToken!, onTokenCardClose, tokenCardTransitionClassNames, tokenCardColor,
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

function renderTokenCard(
  token: UserToken,
  onClose: NoneToVoidFunction,
  classNames: string,
  tokenCardColor?: string,
) {
  const {
    slug, symbol, amount, image, name, price, change30d: change, history,
  } = token;
  const logoPath = slug === TON_TOKEN_SLUG
    ? tonUrl
    : (image || ASSET_LOGO_PATHS[symbol.toLowerCase() as keyof typeof ASSET_LOGO_PATHS]);

  const value = amount * price;
  const changePrefix = change > 0 ? '↑' : change < 0 ? '↓' : undefined;
  const changeValue = Math.abs(round(value * change, 4));
  const changePercent = Math.abs(round(change * 100, 2));

  const shouldRenderPrice = Boolean(price);
  const shouldRenderCoinMarketCap = slug in COIN_MARKET_CAP_TOKENS;

  const hasHistory = history && history.length;
  const historyStartDay = new Date();
  if (history) {
    historyStartDay.setDate(historyStartDay.getDate() - history.length + 1);
  }

  return (
    <div className={buildClassName(styles.container, styles.tokenCard, classNames, tokenCardColor)}>
      <div className={styles.tokenInfo}>
        <Button className={styles.backButton} isSimple onClick={onClose} ariaLabel="Back">
          <i className="icon-arrow-left" aria-hidden />
        </Button>
        <img className={styles.tokenLogo} src={logoPath} alt={token.name} />
        <div>
          <strong className={styles.tokenAmount}>{formatCurrency(amount, symbol)}</strong>
          <span className={styles.tokenName}>{name}</span>
        </div>
      </div>

      {shouldRenderPrice && (
        <div className={styles.tokenPrice}>
          {formatCurrency(value, DEFAULT_PRICE_CURRENCY)}
          {Boolean(changeValue) && (
            <div className={styles.tokenChange}>
              {changePrefix}
              &thinsp;
              {Math.abs(changePercent)}% · {formatCurrency(Math.abs(changeValue), DEFAULT_PRICE_CURRENCY)}
            </div>
          )}
        </div>
      )}

      {hasHistory && (
        <TokenPriceChart
          className={styles.chart}
          width={300}
          height={48}
          prices={history}
        />
      )}

      {hasHistory && (
        <div className={styles.tokenHistoryPrice}>
          {formatCurrency(history[0], DEFAULT_PRICE_CURRENCY)}
          <div className={styles.tokenPriceDate}>
            {formatFullDay(historyStartDay)}
          </div>
        </div>
      )}

      {shouldRenderPrice && (
        <div className={styles.tokenCurrentPrice}>
          {formatCurrency(price, DEFAULT_PRICE_CURRENCY)}
          <div className={styles.tokenPriceDate}>
            Now
            {shouldRenderCoinMarketCap && (
              <>
                {' · '}
                <a
                  href={`https://coinmarketcap.com/currencies/${COIN_MARKET_CAP_TOKENS[slug]}/`}
                  title="Open on CoinMarketCap"
                  target="_blank"
                  rel="noreferrer"
                  className={styles.coinMarket}
                >
                  <i className="icon-coinmarket" aria-hidden />
                </a>
              </>
            ) }
          </div>
        </div>
      )}
    </div>
  );
}
