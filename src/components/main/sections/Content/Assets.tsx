import React, {
  memo, useLayoutEffect, useMemo, useRef,
} from '../../../../lib/teact/teact';
import { setExtraStyles } from '../../../../lib/teact/teact-dom';
import { withGlobal } from '../../../../global';

import type { ApiBaseCurrency, ApiToken, ApiVestingInfo } from '../../../../api/types';
import type { StakingStatus, UserToken } from '../../../../global/types';

import { TONCOIN_SLUG } from '../../../../config';
import {
  selectCurrentAccountStakingStatus,
  selectCurrentAccountState,
  selectCurrentAccountTokens,
  selectIsNewWallet,
  selectMycoin,
} from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { toDecimal } from '../../../../util/decimals';
import { buildCollectionByKey } from '../../../../util/iteratees';
import { REM } from '../../../../util/windowEnvironment';

import useCurrentOrPrev from '../../../../hooks/useCurrentOrPrev';
import { useDeviceScreen } from '../../../../hooks/useDeviceScreen';
import useInfiniteScroll from '../../../../hooks/useInfiniteScroll';
import useShowTransition from '../../../../hooks/useShowTransition';
import useVesting from '../../../../hooks/useVesting';

import InfiniteScroll from '../../../ui/InfiniteScroll';
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
  vesting?: ApiVestingInfo[];
  stakingStatus?: StakingStatus;
  stakingBalance?: bigint;
  isInvestorViewEnabled?: boolean;
  apyValue: number;
  currentTokenSlug?: string;
  baseCurrency?: ApiBaseCurrency;
  mycoin?: ApiToken;
}

const LIST_SLICE = 30;
const TOKEN_HEIGHT_REM = 4;

function Assets({
  isActive,
  tokens,
  isNewWallet,
  vesting,
  stakingStatus,
  stakingBalance,
  isInvestorViewEnabled,
  isSeparatePanel,
  apyValue,
  currentTokenSlug,
  onTokenClick,
  onStakedTokenClick,
  baseCurrency,
  mycoin,
}: OwnProps & StateProps) {
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  const renderedTokens = useCurrentOrPrev(tokens, true);
  const renderedMycoin = useCurrentOrPrev(mycoin, true);

  const toncoin = useMemo(() => renderedTokens?.find(({ slug }) => slug === TONCOIN_SLUG), [renderedTokens])!;
  const userMycoin = useMemo(() => {
    if (!renderedTokens || !renderedMycoin) return undefined;

    return renderedTokens.find(({ slug }) => slug === renderedMycoin.slug);
  }, [renderedMycoin, renderedTokens]);

  const { isLandscape, isPortrait } = useDeviceScreen();

  const shouldShowGreeting = isNewWallet && isPortrait && !isSeparatePanel;

  const { shouldRender: shouldRenderStakedToken, transitionClassNames: stakedTokenClassNames } = useShowTransition(
    Boolean(stakingStatus && toncoin),
  );

  const {
    shouldRender: shouldRenderVestingToken,
    transitionClassNames: vestingTokenClassNames,
    amount: vestingAmount,
    vestingStatus,
    unfreezeEndDate,
    onVestingTokenClick,
  } = useVesting({ vesting, userMycoin });

  const tokenSlugs = useMemo(() => (
    renderedTokens
      ?.filter(({ isDisabled }) => !isDisabled)
      .map(({ slug }) => slug)
  ), [renderedTokens]);
  const [viewportSlugs, getMore] = useInfiniteScroll(
    undefined, tokenSlugs, undefined, undefined, undefined, isActive, isPortrait,
  );
  const viewportIndex = useMemo(() => {
    if (!viewportSlugs) return -1;

    let index = tokenSlugs!.indexOf(viewportSlugs[0]);
    if (shouldRenderStakedToken) {
      index++;
    }
    if (shouldRenderVestingToken) {
      index++;
    }

    return index;
  }, [shouldRenderStakedToken, shouldRenderVestingToken, tokenSlugs, viewportSlugs]);
  const tokensBySlug = useMemo(() => (
    renderedTokens ? buildCollectionByKey(renderedTokens, 'slug') : undefined
  ), [renderedTokens]);
  const withAbsolutePositioning = tokenSlugs && tokenSlugs.length > LIST_SLICE;

  const currentContainerHeight = useMemo(() => {
    if (!withAbsolutePositioning || !viewportSlugs?.length || viewportIndex < 0) return undefined;

    return (viewportIndex + viewportSlugs.length) * TOKEN_HEIGHT_REM * REM;
  }, [viewportIndex, viewportSlugs?.length, withAbsolutePositioning]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    setExtraStyles(container, {
      height: currentContainerHeight && !isLandscape ? `${currentContainerHeight}px` : '',
    });
  }, [isLandscape, currentContainerHeight]);

  function renderVestingToken() {
    return (
      <Token
        key="vesting"
        token={userMycoin!}
        vestingStatus={vestingStatus}
        unfreezeEndDate={unfreezeEndDate}
        amount={vestingAmount}
        isInvestorView={isInvestorViewEnabled}
        classNames={vestingTokenClassNames}
        onClick={onVestingTokenClick}
        baseCurrency={baseCurrency}
      />
    );
  }

  function renderStakedToken() {
    return (
      <Token
        key="staking"
        token={toncoin!}
        stakingStatus={stakingStatus}
        apyValue={apyValue}
        amount={stakingBalance === undefined ? undefined : toDecimal(stakingBalance)}
        isInvestorView={isInvestorViewEnabled}
        classNames={stakedTokenClassNames}
        onClick={onStakedTokenClick}
        baseCurrency={baseCurrency}
      />
    );
  }

  function renderToken(token: UserToken, indexInViewport: number) {
    const style = withAbsolutePositioning
      ? `position: absolute; top: ${(viewportIndex + indexInViewport) * TOKEN_HEIGHT_REM}rem`
      : undefined;

    return (
      <Token
        classNames="token-list-item"
        style={style}
        key={token.slug}
        token={token}
        apyValue={!stakingBalance && token.slug === TONCOIN_SLUG ? apyValue : undefined}
        isInvestorView={isInvestorViewEnabled}
        isActive={token.slug === currentTokenSlug}
        baseCurrency={baseCurrency}
        onClick={onTokenClick}
      />
    );
  }

  return (
    <InfiniteScroll
      ref={containerRef}
      className={buildClassName(styles.wrapper, isSeparatePanel && !renderedTokens && styles.wrapperLoading)}
      scrollContainerClosest={!isLandscape && isActive ? '.app-slide-content' : undefined}
      items={viewportSlugs}
      itemSelector=".token-list-item"
      withAbsolutePositioning={withAbsolutePositioning}
      maxHeight={currentContainerHeight}
      onLoadMore={getMore}
    >
      {!renderedTokens && (
        <div key="loading" className={isSeparatePanel ? styles.emptyListSeparate : styles.emptyList}>
          <Loading />
        </div>
      )}
      {shouldShowGreeting && <NewWalletGreeting key="new-wallet-greeting" isActive={isActive} mode="panel" />}
      {shouldRenderVestingToken && renderVestingToken()}
      {shouldRenderStakedToken && renderStakedToken()}
      {viewportSlugs?.map((tokenSlug, i) => renderToken(tokensBySlug![tokenSlug], i))}
    </InfiniteScroll>
  );
}

export default memo(
  withGlobal<OwnProps>(
    (global): StateProps => {
      const tokens = selectCurrentAccountTokens(global);
      const isNewWallet = selectIsNewWallet(global);
      const accountState = selectCurrentAccountState(global);
      const { isInvestorViewEnabled } = global.settings;
      const stakingStatus = selectCurrentAccountStakingStatus(global);

      return {
        tokens,
        isNewWallet,
        stakingStatus,
        vesting: accountState?.vesting?.info,
        stakingBalance: accountState?.staking?.balance,
        isInvestorViewEnabled,
        apyValue: accountState?.staking?.apy || 0,
        currentTokenSlug: accountState?.currentTokenSlug,
        baseCurrency: global.settings.baseCurrency,
        mycoin: selectMycoin(global),
      };
    },
    (global, _, stickToFirst) => stickToFirst(global.currentAccountId),
  )(Assets),
);
