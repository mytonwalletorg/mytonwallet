import React, {
  memo, useCallback, useEffect, useMemo,
} from '../../../../lib/teact/teact';
import { UserToken } from '../../../../global/types';

import { getActions, withGlobal } from '../../../../global';
import {
  DEFAULT_PRICE_CURRENCY,
  TON_TOKEN_SLUG,
  TONSCAN_BASE_MAINNET_URL,
  TONSCAN_BASE_TESTNET_URL,
} from '../../../../config';
import { selectAccount, selectCurrentAccountTokens, selectCurrentAccountState } from '../../../../global/selectors';
import { formatCurrency, formatInteger } from '../../../../util/formatNumber';
import { copyTextToClipboard } from '../../../../util/clipboard';
import buildClassName from '../../../../util/buildClassName';
import captureEscKeyListener from '../../../../util/captureEscKeyListener';
import { calcChangeValue } from '../../../../util/calcChangeValue';
import { getTokenCardColor } from '../../helpers/card_colors';
import { shortenAddress } from '../../../../util/shortenAddress';
import { round } from '../../../../util/round';
import useCurrentOrPrev from '../../../../hooks/useCurrentOrPrev';
import useShowTransition from '../../../../hooks/useShowTransition';
import useLang from '../../../../hooks/useLang';

import Loading from '../../../ui/Loading';

import TokenCard from './TokenCard';
import AccountSelector from './AccountSelector';

import styles from './Card.module.scss';

interface OwnProps {
  onTokenCardClose: NoneToVoidFunction;
  onApyClick: NoneToVoidFunction;
}

interface StateProps {
  address?: string;
  tokens?: UserToken[];
  currentTokenSlug?: string;
  isTestnet?: boolean;
}

function Card({
  address,
  tokens,
  currentTokenSlug,
  onTokenCardClose,
  onApyClick,
  isTestnet,
}: OwnProps & StateProps) {
  const { showNotification } = getActions();

  const lang = useLang();
  const tonscanBaseUrl = isTestnet ? TONSCAN_BASE_TESTNET_URL : TONSCAN_BASE_MAINNET_URL;
  const tonscanAddressUrl = `${tonscanBaseUrl}address/${address}`;

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

    showNotification({ message: lang('Address was copied!') as string, icon: 'icon-copy' });
    copyTextToClipboard(address);
  }, [address, lang, showNotification]);

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
        <AccountSelector />
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
          <button
            type="button"
            className={styles.address}
            aria-label={lang('Copy wallet address')}
            onClick={handleCopyAddress}
          >
            {address && shortenAddress(address)}
            <i className={buildClassName(styles.icon, 'icon-copy')} aria-hidden />
          </button>
          <a
            href={tonscanAddressUrl}
            className={styles.tonscanButton}
            title={lang('View address on TON Explorer')}
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
          onApyClick={onApyClick}
          onClose={onTokenCardClose}
        />
      )}
    </div>
  );
}

export default memo(withGlobal<OwnProps>((global): StateProps => {
  const { address } = selectAccount(global, global.currentAccountId!) || {};

  return {
    address,
    tokens: selectCurrentAccountTokens(global),
    currentTokenSlug: selectCurrentAccountState(global)?.currentTokenSlug,
    isTestnet: global.settings.isTestnet,
  };
})(Card));

function buildValues(tokens: UserToken[]) {
  const primaryValue = tokens.reduce((acc, token) => acc + token.amount * token.price, 0);
  const [primaryWholePart, primaryFractionPart] = formatInteger(primaryValue).split('.');
  const changeValue = round(tokens.reduce((acc, token) => {
    return acc + calcChangeValue(token.amount * token.price, token.change24h);
  }, 0), 4);

  const changePercent = round(primaryValue ? (changeValue / (primaryValue - changeValue)) * 100 : 0, 2);
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
