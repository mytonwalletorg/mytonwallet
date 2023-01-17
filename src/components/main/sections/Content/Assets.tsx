import React, { memo, useMemo } from '../../../../lib/teact/teact';
import { withGlobal } from '../../../../global';

import { UserToken } from '../../../../global/types';

import { ANIMATED_STICKERS_PATHS } from '../../../ui/helpers/animatedAssets';
import { ANIMATED_STICKER_SMALL_SIZE_PX, TON_TOKEN_SLUG } from '../../../../config';
import { selectCurrentAccountState, selectCurrentAccountTokens } from '../../../../global/selectors';
import useLang from '../../../../hooks/useLang';
import useShowTransition from '../../../../hooks/useShowTransition';

import AnimatedIconWithPreview from '../../../ui/AnimatedIconWithPreview';
import Loading from '../../../ui/Loading';
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
  const lang = useLang();

  const tonToken = useMemo(() => tokens?.find(({ slug }) => slug === TON_TOKEN_SLUG), [tokens])!;
  const {
    shouldRender: shouldRenderStakedToken,
    transitionClassNames: stakedTokenClassNames,
  } = useShowTransition(Boolean(stakingStatus));

  function renderNewWalletGreetings() {
    return (
      <div className={styles.greetings}>
        <AnimatedIconWithPreview
          play={isActive}
          tgsUrl={ANIMATED_STICKERS_PATHS.hello}
          previewUrl={ANIMATED_STICKERS_PATHS.helloPreview}
          nonInteractive
          noLoop={false}
          size={ANIMATED_STICKER_SMALL_SIZE_PX}
        />

        <div className={styles.greetingsText}>
          <p className={styles.greetingsHeader}>{lang('You have just created a new wallet')}</p>
          <p className={styles.greetingsDescription}>
            {lang('You can now transfer your tokens from another wallet or exchange.')}
          </p>
        </div>
      </div>
    );
  }

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

  return (
    <div>
      {!tokens && <div className={styles.emptyList}><Loading /></div>}
      {isNewWallet && renderNewWalletGreetings()}
      {shouldRenderStakedToken && renderStakedToken()}
      {tokens && tokens.map((token) => (
        <Token
          key={token.slug}
          token={token}
          apyValue={!stakingBalance && token.slug === TON_TOKEN_SLUG ? apyValue : undefined}
          isInvestorView={isInvestorViewEnabled}
          onClick={onTokenClick}
        />
      ))}
    </div>
  );
}

export default memo(withGlobal<OwnProps>((global, ownProps, detachWhenChanged): StateProps => {
  detachWhenChanged(global.currentAccountId);

  const tokens = selectCurrentAccountTokens(global);
  const accountState = selectCurrentAccountState(global);
  const { isInvestorViewEnabled } = global.settings;
  const stakingStatus = accountState?.stakingBalance
    ? (accountState.isUnstakeRequested ? 'unstakeRequested' : 'active')
    : undefined;

  return {
    tokens,
    stakingStatus,
    stakingBalance: accountState?.stakingBalance,
    isNewWallet: tokens?.length === 0 || (tokens?.length === 1 && tokens[0].amount === 0),
    isInvestorViewEnabled,
    apyValue: accountState?.poolState?.lastApy || 0,
  };
})(Assets));
