import type { Ref } from 'react';
import React, { memo, useEffect, useMemo } from '../../../../lib/teact/teact';
import { withGlobal } from '../../../../global';

import type { ApiBaseCurrency } from '../../../../api/types';
import type { UserToken } from '../../../../global/types';

import { IS_EXTENSION } from '../../../../config';
import {
  selectCurrentAccountState,
  selectCurrentAccountTokens,
  selectCurrentNetwork,
} from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import captureEscKeyListener from '../../../../util/captureEscKeyListener';
import { formatCurrency, getShortCurrencySymbol } from '../../../../util/formatNumber';
import { shortenAddress } from '../../../../util/shortenAddress';
import { IS_IOS, IS_SAFARI } from '../../../../util/windowEnvironment';
import { calculateFullBalance } from './helpers/calculateFullBalance';

import useCurrentOrPrev from '../../../../hooks/useCurrentOrPrev';
import useFlag from '../../../../hooks/useFlag';
import useHistoryBack from '../../../../hooks/useHistoryBack';
import useShowTransition from '../../../../hooks/useShowTransition';
import useUpdateIndicator from '../../../../hooks/useUpdateIndicator';

import AnimatedCounter from '../../../ui/AnimatedCounter';
import Loading from '../../../ui/Loading';
import LoadingDots from '../../../ui/LoadingDots';
import Transition from '../../../ui/Transition';
import AccountSelector from './AccountSelector';
import CardAddress from './CardAddress';
import CurrencySwitcher from './CurrencySwitcher';
import TokenCard from './TokenCard';

import styles from './Card.module.scss';

interface OwnProps {
  ref?: Ref<HTMLDivElement>;
  forceCloseAccountSelector?: boolean;
  onTokenCardClose: NoneToVoidFunction;
  onApyClick: NoneToVoidFunction;
}

interface StateProps {
  tokens?: UserToken[];
  activeDappOrigin?: string;
  currentTokenSlug?: string;
  baseCurrency?: ApiBaseCurrency;
  stakingBalance?: bigint;
  balanceUpdateStartedAt?: number;
}

function Card({
  ref,
  tokens,
  activeDappOrigin,
  currentTokenSlug,
  forceCloseAccountSelector,
  onTokenCardClose,
  onApyClick,
  baseCurrency,
  stakingBalance,
  balanceUpdateStartedAt,
}: OwnProps & StateProps) {
  const shortBaseSymbol = getShortCurrencySymbol(baseCurrency);

  const isUpdating = useUpdateIndicator(balanceUpdateStartedAt);

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
    const noAnimationCounter = !isUpdating || IS_SAFARI || IS_IOS;
    return (
      <>
        <Transition activeKey={isUpdating ? 1 : 0} name="fade" shouldCleanup className={styles.balanceTransition}>
          <div className={styles.primaryValue}>
            <span
              className={buildClassName(styles.currencySwitcher, isUpdating && 'glare-text')}
              role="button"
              tabIndex={0}
              onClick={openCurrencyMenu}
            >
              {shortBaseSymbol.length === 1 && shortBaseSymbol}
              <AnimatedCounter isDisabled={noAnimationCounter} text={primaryWholePart ?? ''} />
              {primaryFractionPart && (
                <span className={styles.primaryFractionPart}>
                  <AnimatedCounter isDisabled={noAnimationCounter} text={`.${primaryFractionPart}`} />
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
        </Transition>
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
      <Transition activeKey={isUpdating ? 1 : 0} name="fade" shouldCleanup className={styles.loadingDotsContainer}>
        {isUpdating ? <LoadingDots isActive isDoubled /> : undefined}
      </Transition>
      <div className={buildClassName(styles.container, currentTokenSlug && styles.backstage)}>
        <AccountSelector forceClose={forceCloseAccountSelector} canEdit />
        {shouldRenderDapp && (
          <div className={buildClassName(styles.dapp, dappClassNames)}>
            <i className={buildClassName(styles.dappIcon, 'icon-laptop')} aria-hidden />
            {renderingDappDomain}
          </div>
        )}
        {values ? renderBalance() : renderLoader()}
        <CardAddress />
      </div>
      {shouldRenderTokenCard && (
        <TokenCard
          token={renderedToken!}
          classNames={tokenCardTransitionClassNames}
          isUpdating={isUpdating}
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
      const accountState = selectCurrentAccountState(global);
      const stakingBalance = selectCurrentNetwork(global) === 'mainnet'
        ? accountState?.staking?.balance
        : 0n;

      return {
        tokens: selectCurrentAccountTokens(global),
        activeDappOrigin: accountState?.activeDappOrigin,
        currentTokenSlug: accountState?.currentTokenSlug,
        baseCurrency: global.settings.baseCurrency,
        stakingBalance,
        balanceUpdateStartedAt: global.balanceUpdateStartedAt,
      };
    },
    (global, _, stickToFirst) => stickToFirst(global.currentAccountId),
  )(Card),
);
