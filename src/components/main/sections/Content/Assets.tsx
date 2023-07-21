import React, { memo, useMemo } from '../../../../lib/teact/teact';

import type { UserToken } from '../../../../global/types';

import { TON_TOKEN_SLUG } from '../../../../config';
import { withGlobal } from '../../../../global';
import { selectCurrentAccountState, selectCurrentAccountTokens, selectIsNewWallet } from '../../../../global/selectors';

import { useDeviceScreen } from '../../../../hooks/useDeviceScreen';
import useShowTransition from '../../../../hooks/useShowTransition';

import Loading from '../../../ui/Loading';
import NewWalletGreeting from './NewWalletGreeting';
import Token from './Token';

import styles from './Assets.module.scss';

type OwnProps = {
  isActive?: boolean;
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
}

function Assets({
  isActive,
  tokens,
  isNewWallet,
  stakingStatus,
  stakingBalance,
  isInvestorViewEnabled,
  apyValue,
  onTokenClick,
  onStakedTokenClick,
}: OwnProps & StateProps) {
  const { isPortrait } = useDeviceScreen();

  const shouldShowGreeting = isNewWallet && isPortrait;
  const tonToken = useMemo(() => tokens?.find(({ slug }) => slug === TON_TOKEN_SLUG), [tokens])!;
  const { shouldRender: shouldRenderStakedToken, transitionClassNames: stakedTokenClassNames } = useShowTransition(
    Boolean(stakingStatus),
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
        onClick={onTokenClick}
      />
    );
  }

  return (
    <div className={styles.wrapper}>
      {!tokens && (
        <div className={styles.emptyList}>
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
  withGlobal<OwnProps>((global, ownProps, detachWhenChanged): StateProps => {
    detachWhenChanged(global.currentAccountId);

    const tokens = selectCurrentAccountTokens(global);
    const isNewWallet = selectIsNewWallet(global);
    const accountState = selectCurrentAccountState(global);
    const { isInvestorViewEnabled } = global.settings;
    const stakingStatus = accountState?.stakingBalance
      ? accountState.isUnstakeRequested
        ? 'unstakeRequested'
        : 'active'
      : undefined;

    return {
      tokens,
      isNewWallet,
      stakingStatus,
      stakingBalance: accountState?.stakingBalance,
      isInvestorViewEnabled,
      apyValue: accountState?.poolState?.lastApy || 0,
    };
  })(Assets),
);
