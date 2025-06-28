import React from '../../../../lib/teact/teact';

import type {
  ApiActivity,
  ApiBaseCurrency,
  ApiNft,
  ApiStakingState,
  ApiSwapAsset,
  ApiTokenWithPrice,
} from '../../../../api/types';
import type { Account, AppTheme, SavedAddress } from '../../../../global/types';

import Swap, { getSwapHeight } from './Swap';
import Transaction, { getTransactionHeight } from './Transaction';

interface OwnProps {
  activity: ApiActivity;
  isLast?: boolean;
  isActive?: boolean;
  isSensitiveDataHidden?: boolean;
  isFuture?: boolean;
  withChainIcon?: boolean;
  tokensBySlug: Record<string, ApiTokenWithPrice>;
  swapTokensBySlug?: Record<string, ApiSwapAsset>;
  appTheme: AppTheme;
  nftsByAddress?: Record<string, ApiNft>;
  currentAccountId: string;
  stakingStateBySlug?: Record<string, ApiStakingState>;
  savedAddresses?: SavedAddress[];
  accounts?: Record<string, Account>;
  baseCurrency?: ApiBaseCurrency;
  onClick?: (id: string) => void;
}

export default function Activity({
  activity,
  isLast,
  isActive,
  isSensitiveDataHidden,
  isFuture,
  withChainIcon,
  tokensBySlug,
  swapTokensBySlug,
  appTheme,
  nftsByAddress,
  currentAccountId,
  stakingStateBySlug,
  savedAddresses,
  accounts,
  baseCurrency,
  onClick,
}: OwnProps) {
  if (activity.kind === 'swap') {
    return (
      <Swap
        key={activity.id}
        activity={activity}
        tokensBySlug={swapTokensBySlug}
        isLast={isLast}
        isActive={isActive}
        appTheme={appTheme}
        addressByChain={accounts?.[currentAccountId]?.addressByChain}
        isSensitiveDataHidden={isSensitiveDataHidden}
        isFuture={isFuture}
        onClick={onClick}
      />
    );
  } else {
    const doesNftExist = Boolean(activity.nft && nftsByAddress?.[activity.nft.address]);
    const { annualYield, yieldType } = stakingStateBySlug?.[activity.slug] ?? {};

    return (
      <Transaction
        key={activity.id}
        currentAccountId={currentAccountId}
        transaction={activity}
        tokensBySlug={tokensBySlug}
        isActive={isActive}
        annualYield={annualYield}
        yieldType={yieldType}
        isLast={isLast}
        savedAddresses={savedAddresses}
        withChainIcon={withChainIcon}
        appTheme={appTheme}
        doesNftExist={doesNftExist}
        isSensitiveDataHidden={isSensitiveDataHidden}
        isFuture={isFuture}
        accounts={accounts}
        baseCurrency={baseCurrency}
        onClick={onClick}
      />
    );
  }
}

export function getActivityHeight(activity: ApiActivity, isFuture?: boolean) {
  return activity.kind === 'swap' ? getSwapHeight() : getTransactionHeight(activity, isFuture);
}
