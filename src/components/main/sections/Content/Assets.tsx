import React, { memo, useMemo } from '../../../../lib/teact/teact';
import { withGlobal } from '../../../../global';

import type { ApiBaseCurrency } from '../../../../api/types';
import type { UserToken } from '../../../../global/types';

import { TON_TOKEN_SLUG } from '../../../../config';
import { selectCurrentAccountState, selectCurrentAccountTokens, selectIsNewWallet } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';

import { useDeviceScreen } from '../../../../hooks/useDeviceScreen';
import useShowTransition from '../../../../hooks/useShowTransition';

import Loading from '../../../ui/Loading';
import NewWalletGreeting from './NewWalletGreeting';
import Token from './Token';

import styles from './Assets.module.scss';

type OwnProps = {
  isActive?: boolean;
  isSeparatePanel?: boolean;
  onTokenClick: (slug: string) => void;
  onStakedTokenClick: NoneToVoidFunction;
};

interface StateProps {
  tokens?: UserToken[];
  isNewWallet: boolean;
  stakingStatus?: 'active' | 'unstakeRequested';
  stakingBalance?: number;
  isInvestorViewEnabled?: boolean;
  apyValue: number;
  currentTokenSlug?: string;
  baseCurrency?: ApiBaseCurrency;
}

function Assets({
  isActive,
  tokens,
  isNewWallet,
  stakingStatus,
  stakingBalance,
  isInvestorViewEnabled,
  isSeparatePanel,
  apyValue,
  currentTokenSlug,
  onTokenClick,
  onStakedTokenClick,
  baseCurrency,
}: OwnProps & StateProps) {
  const { isPortrait } = useDeviceScreen();

  const shouldShowGreeting = isNewWallet && isPortrait && !isSeparatePanel;
  const tonToken = useMemo(() => tokens?.find(({ slug }) => slug === TON_TOKEN_SLUG), [tokens])!;
  const { shouldRender: shouldRenderStakedToken, transitionClassNames: stakedTokenClassNames } = useShowTransition(
    Boolean(stakingStatus && tonToken),
  );

  function renderStakedToken() {
    return (
      <Token
        key="staking"
        token={tonToken!}
        stakingStatus={stakingStatus}
        apyValue={apyValue}
        amount={stakingBalance}
        isInvestorView={isInvestorViewEnabled}
        classNames={stakedTokenClassNames}
        onClick={onStakedTokenClick}
        baseCurrency={baseCurrency}
      />
    );
  }

  function renderToken(token: UserToken) {
    if (token.isDisabled) return undefined;

    return (
      <Token
        key={token.slug}
        token={token}
        apyValue={!stakingBalance && token.slug === TON_TOKEN_SLUG ? apyValue : undefined}
        isInvestorView={isInvestorViewEnabled}
        isActive={token.slug === currentTokenSlug}
        onClick={onTokenClick}
        baseCurrency={baseCurrency}
      />
    );
  }

  return (
    <div className={buildClassName(styles.wrapper, isSeparatePanel && !tokens && styles.wrapperLoading)}>
      {!tokens && (
        <div className={isSeparatePanel ? styles.emptyListSeparate : styles.emptyList}>
          <Loading />
        </div>
      )}
      {shouldShowGreeting && <NewWalletGreeting isActive={isActive} mode="panel" />}
      {shouldRenderStakedToken && renderStakedToken()}
      {tokens && tokens.map(renderToken)}
    </div>
  );
}

export default memo(
  withGlobal<OwnProps>(
    (global): StateProps => {
      const tokens = selectCurrentAccountTokens(global);
      const isNewWallet = selectIsNewWallet(global);
      const accountState = selectCurrentAccountState(global);
      const { isInvestorViewEnabled } = global.settings;
      const stakingStatus = accountState?.staking?.balance
        ? accountState.staking.isUnstakeRequested
          ? 'unstakeRequested'
          : 'active'
        : undefined;

      return {
        tokens,
        isNewWallet,
        stakingStatus,
        stakingBalance: accountState?.staking?.balance,
        isInvestorViewEnabled,
        apyValue: accountState?.staking?.apy || 0,
        currentTokenSlug: accountState?.currentTokenSlug,
        baseCurrency: global.settings.baseCurrency,
      };
    },
    (global, _, stickToFirst) => stickToFirst(global.currentAccountId),
  )(Assets),
);
