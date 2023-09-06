import type { Ref } from 'react';
import React, {
  memo, useEffect, useMemo,
} from '../../../../lib/teact/teact';

import type { UserToken } from '../../../../global/types';

import {
  DEFAULT_PRICE_CURRENCY,
  TON_TOKEN_SLUG,
  TONSCAN_BASE_MAINNET_URL,
  TONSCAN_BASE_TESTNET_URL,
} from '../../../../config';
import { getActions, withGlobal } from '../../../../global';
import { selectAccount, selectCurrentAccountState, selectCurrentAccountTokens } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import captureEscKeyListener from '../../../../util/captureEscKeyListener';
import { copyTextToClipboard } from '../../../../util/clipboard';
import { formatCurrency } from '../../../../util/formatNumber';
import { shortenAddress } from '../../../../util/shortenAddress';
import { getTokenCardColor } from '../../helpers/card_colors';
import { buildTokenValues } from './helpers/buildTokenValues';

import useCurrentOrPrev from '../../../../hooks/useCurrentOrPrev';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';
import useShowTransition from '../../../../hooks/useShowTransition';

import Loading from '../../../ui/Loading';
import AccountSelector from './AccountSelector';
import TokenCard from './TokenCard';

import styles from './Card.module.scss';

interface OwnProps {
  ref?: Ref<HTMLDivElement>;
  onTokenCardClose: NoneToVoidFunction;
  onApyClick: NoneToVoidFunction;
}

interface StateProps {
  address?: string;
  tokens?: UserToken[];
  activeDappOrigin?: string;
  currentTokenSlug?: string;
  isTestnet?: boolean;
}

function Card({
  ref,
  address,
  tokens,
  activeDappOrigin,
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
  const dappDomain = useMemo(() => {
    if (!activeDappOrigin) {
      return undefined;
    }

    let value: string | undefined;
    try {
      value = new URL(activeDappOrigin).hostname;
    } catch (err) {
      value = shortenAddress(activeDappOrigin);
    }

    return value;
  }, [activeDappOrigin]);
  const renderingDappDomain = useCurrentOrPrev(dappDomain, true);

  const values = useMemo(() => {
    return tokens ? buildTokenValues(tokens) : undefined;
  }, [tokens]);

  const {
    shouldRender: shouldRenderDapp,
    transitionClassNames: dappClassNames,
  } = useShowTransition(Boolean(dappDomain));

  useEffect(
    () => (shouldRenderTokenCard ? captureEscKeyListener(onTokenCardClose) : undefined),
    [shouldRenderTokenCard, onTokenCardClose],
  );

  const handleCopyAddress = useLastCallback(() => {
    if (!address) return;

    showNotification({ message: lang('Address was copied!') as string, icon: 'icon-copy' });
    copyTextToClipboard(address);
  });

  const {
    primaryValue, primaryWholePart, primaryFractionPart, changeClassName, changePrefix, changePercent, changeValue,
  } = values || {};

  function renderLoader() {
    return (
      <div className={buildClassName(styles.container, styles.isLoading)}>
        <Loading color="white" />
      </div>
    );
  }

  function renderContent() {
    return (
      <>
        <div className={buildClassName(styles.container, currentTokenSlug && styles.backstage)}>
          <AccountSelector canEdit />
          {shouldRenderDapp && (
            <div className={buildClassName(styles.dapp, dappClassNames)}>
              <i className={buildClassName(styles.dappIcon, 'icon-laptop')} aria-hidden />
              {renderingDappDomain}
            </div>
          )}
          <div className={styles.primaryValue}>
            {DEFAULT_PRICE_CURRENCY}
            {primaryWholePart}
            {primaryFractionPart && <span className={styles.primaryFractionPart}>.{primaryFractionPart}</span>}
          </div>
          {primaryValue !== 0 && (
            <div className={buildClassName(styles.change, changeClassName)}>
              {changePrefix}
              &thinsp;
              {Math.abs(changePercent!)}% · {formatCurrency(Math.abs(changeValue!), DEFAULT_PRICE_CURRENCY)}
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
      </>
    );
  }

  return (
    <div className={styles.containerWrapper} ref={ref}>
      {!values ? renderLoader() : renderContent()}
    </div>
  );
}

export default memo(withGlobal<OwnProps>((global, ownProps, detachWhenChanged): StateProps => {
  detachWhenChanged(global.currentAccountId);
  const { address } = selectAccount(global, global.currentAccountId!) || {};
  const accountState = selectCurrentAccountState(global);

  return {
    address,
    tokens: selectCurrentAccountTokens(global),
    activeDappOrigin: accountState?.activeDappOrigin,
    currentTokenSlug: accountState?.currentTokenSlug,
    isTestnet: global.settings.isTestnet,
  };
})(Card));
