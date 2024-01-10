import type { Ref } from 'react';
import React, { memo, useEffect, useMemo } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ApiBaseCurrency } from '../../../../api/types';
import type { UserToken } from '../../../../global/types';

import {
  IS_CAPACITOR, TON_TOKEN_SLUG, TONSCAN_BASE_MAINNET_URL, TONSCAN_BASE_TESTNET_URL,
} from '../../../../config';
import { selectAccount, selectCurrentAccountState, selectCurrentAccountTokens } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { vibrateOnSuccess } from '../../../../util/capacitor';
import captureEscKeyListener from '../../../../util/captureEscKeyListener';
import { copyTextToClipboard } from '../../../../util/clipboard';
import { formatCurrency, getShortCurrencySymbol } from '../../../../util/formatNumber';
import { shortenAddress } from '../../../../util/shortenAddress';
import { getTokenCardColor } from '../../helpers/card_colors';
import { calculateFullBalance } from './helpers/calculateFullBalance';

import useCurrentOrPrev from '../../../../hooks/useCurrentOrPrev';
import useHistoryBack from '../../../../hooks/useHistoryBack';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';
import useShowTransition from '../../../../hooks/useShowTransition';

import AnimatedCounter from '../../../ui/AnimatedCounter';
import Loading from '../../../ui/Loading';
import AccountSelector from './AccountSelector';
import TokenCard from './TokenCard';

import styles from './Card.module.scss';

interface OwnProps {
  ref?: Ref<HTMLDivElement>;
  forceCloseAccountSelector?: boolean;
  onTokenCardClose: NoneToVoidFunction;
  onApyClick: NoneToVoidFunction;
  onQrScanPress?: NoneToVoidFunction;
}

interface StateProps {
  address?: string;
  tokens?: UserToken[];
  activeDappOrigin?: string;
  currentTokenSlug?: string;
  isTestnet?: boolean;
  baseCurrency?: ApiBaseCurrency;
  stakingBalance?: number;
}

function Card({
  ref,
  address,
  tokens,
  activeDappOrigin,
  currentTokenSlug,
  forceCloseAccountSelector,
  onTokenCardClose,
  onApyClick,
  onQrScanPress,
  isTestnet,
  baseCurrency,
  stakingBalance,
}: OwnProps & StateProps) {
  const { showNotification } = getActions();

  const lang = useLang();
  const tonscanBaseUrl = isTestnet ? TONSCAN_BASE_TESTNET_URL : TONSCAN_BASE_MAINNET_URL;
  const tonscanAddressUrl = `${tonscanBaseUrl}address/${address}`;
  const shortBaseSymbol = getShortCurrencySymbol(baseCurrency);

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
    return tokens ? calculateFullBalance(tokens, stakingBalance) : undefined;
  }, [tokens, stakingBalance]);

  const {
    shouldRender: shouldRenderDapp,
    transitionClassNames: dappClassNames,
  } = useShowTransition(Boolean(dappDomain));

  useHistoryBack({
    isActive: Boolean(currentTokenSlug),
    onBack: onTokenCardClose,
  });

  useEffect(
    () => (shouldRenderTokenCard ? captureEscKeyListener(onTokenCardClose) : undefined),
    [shouldRenderTokenCard, onTokenCardClose],
  );

  const handleCopyAddress = useLastCallback(() => {
    if (!address) return;

    showNotification({ message: lang('Address was copied!') as string, icon: 'icon-copy' });
    void copyTextToClipboard(address);
    if (IS_CAPACITOR) {
      void vibrateOnSuccess();
    }
  });

  const {
    primaryValue, primaryWholePart, primaryFractionPart, changeClassName, changePrefix, changePercent, changeValue,
  } = values || {};

  function renderLoader() {
    return (
      <div className={buildClassName(styles.isLoading)}>
        <Loading color="white" className={styles.center} />
      </div>
    );
  }

  function renderBalance() {
    return (
      <>
        <div className={styles.primaryValue}>
          {shortBaseSymbol.length === 1 && shortBaseSymbol}
          <AnimatedCounter text={primaryWholePart ?? ''} />
          {primaryFractionPart && (
            <span className={styles.primaryFractionPart}>
              <AnimatedCounter text={`.${primaryFractionPart}`} />
            </span>
          )}
          {shortBaseSymbol.length > 1 && (
            <span className={styles.primaryFractionPart}>
                &nbsp;{shortBaseSymbol}
            </span>
          )}
        </div>
        {primaryValue !== 0 && (
          <div className={buildClassName(styles.change, changeClassName)}>
            {changePrefix}
            &thinsp;
            <AnimatedCounter text={`${Math.abs(changePercent!)}%`} />
            {' · '}
            <AnimatedCounter text={formatCurrency(Math.abs(changeValue!), shortBaseSymbol)} />
          </div>
        )}
      </>
    );
  }

  return (
    <div className={styles.containerWrapper} ref={ref}>
      <div className={buildClassName(styles.container, currentTokenSlug && styles.backstage)}>
        <AccountSelector forceClose={forceCloseAccountSelector} canEdit onQrScanPress={onQrScanPress} />
        {shouldRenderDapp && (
          <div className={buildClassName(styles.dapp, dappClassNames)}>
            <i className={buildClassName(styles.dappIcon, 'icon-laptop')} aria-hidden />
            {renderingDappDomain}
          </div>
        )}
        {values ? renderBalance() : renderLoader()}
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

export default memo(
  withGlobal<OwnProps>(
    (global): StateProps => {
      const { address } = selectAccount(global, global.currentAccountId!) || {};
      const accountState = selectCurrentAccountState(global);

      return {
        address,
        tokens: selectCurrentAccountTokens(global),
        activeDappOrigin: accountState?.activeDappOrigin,
        currentTokenSlug: accountState?.currentTokenSlug,
        isTestnet: global.settings.isTestnet,
        baseCurrency: global.settings.baseCurrency,
        stakingBalance: accountState?.staking?.balance,
      };
    },
    (global, _, stickToFirst) => stickToFirst(global.currentAccountId),
  )(Card),
);
