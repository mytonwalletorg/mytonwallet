import type { Ref } from 'react';
import React, { memo, useEffect, useMemo } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ApiBaseCurrency } from '../../../../api/types';
import type { UserToken } from '../../../../global/types';

import {
  IS_EXTENSION, TONSCAN_BASE_MAINNET_URL, TONSCAN_BASE_TESTNET_URL,
} from '../../../../config';
import {
  selectAccount,
  selectCurrentAccountState,
  selectCurrentAccountTokens,
  selectCurrentNetwork,
} from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import captureEscKeyListener from '../../../../util/captureEscKeyListener';
import { copyTextToClipboard } from '../../../../util/clipboard';
import { formatCurrency, getShortCurrencySymbol } from '../../../../util/formatNumber';
import { shortenAddress } from '../../../../util/shortenAddress';
import { calculateFullBalance } from './helpers/calculateFullBalance';

import useCurrentOrPrev from '../../../../hooks/useCurrentOrPrev';
import useFlag from '../../../../hooks/useFlag';
import useHistoryBack from '../../../../hooks/useHistoryBack';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';
import useShowTransition from '../../../../hooks/useShowTransition';

import AnimatedCounter from '../../../ui/AnimatedCounter';
import Loading from '../../../ui/Loading';
import AccountSelector from './AccountSelector';
import CurrencySwitcher from './CurrencySwitcher';
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
  stakingBalance?: bigint;
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

  const [isCurrencyMenuOpen, openCurrencyMenu, closeCurrencyMenu] = useFlag(false);
  const currentToken = useMemo(() => {
    return tokens ? tokens.find((token) => token.slug === currentTokenSlug) : undefined;
  }, [currentTokenSlug, tokens]);
  const renderedToken = useCurrentOrPrev(currentToken, true);
  const {
    shouldRender: shouldRenderTokenCard,
    transitionClassNames: tokenCardTransitionClassNames,
  } = useShowTransition(Boolean(currentTokenSlug), undefined, true);

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
    shouldRender: shouldRenderDappElement,
    transitionClassNames: dappClassNames,
  } = useShowTransition(Boolean(dappDomain));

  const shouldRenderDapp = IS_EXTENSION && shouldRenderDappElement;

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
    const iconCaretClassNames = buildClassName(
      'icon',
      'icon-caret-down',
      primaryFractionPart || shortBaseSymbol.length > 1 ? styles.iconCaretFraction : styles.iconCaret,
    );
    return (
      <>
        <div className={styles.primaryValue}>
          <span className={styles.currencySwitcher} role="button" tabIndex={0} onClick={openCurrencyMenu}>
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
            <i className={iconCaretClassNames} aria-hidden />
          </span>
        </div>
        <CurrencySwitcher isOpen={isCurrencyMenuOpen} onClose={closeCurrencyMenu} />
        {primaryValue !== '0' && (
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
      const stakingBalance = selectCurrentNetwork(global) === 'mainnet'
        ? accountState?.staking?.balance
        : 0n;

      return {
        address,
        tokens: selectCurrentAccountTokens(global),
        activeDappOrigin: accountState?.activeDappOrigin,
        currentTokenSlug: accountState?.currentTokenSlug,
        isTestnet: global.settings.isTestnet,
        baseCurrency: global.settings.baseCurrency,
        stakingBalance,
      };
    },
    (global, _, stickToFirst) => stickToFirst(global.currentAccountId),
  )(Card),
);
