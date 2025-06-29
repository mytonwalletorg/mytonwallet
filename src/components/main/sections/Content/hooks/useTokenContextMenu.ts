import { type ElementRef, useMemo } from '../../../../../lib/teact/teact';
import { getActions } from '../../../../../global';

import type { ApiStakingState } from '../../../../../api/types';
import type { UserToken } from '../../../../../global/types';
import type { DropdownItem } from '../../../../ui/Dropdown';
import { ActiveTab, SettingsState } from '../../../../../global/types';

import { DEFAULT_SWAP_FIRST_TOKEN_SLUG, DEFAULT_SWAP_SECOND_TOKEN_SLUG } from '../../../../../config';
import { vibrate } from '../../../../../util/haptics';
import { compact } from '../../../../../util/iteratees';
import { getStakingStateStatus } from '../../../../../util/staking';
import { getIsServiceToken } from '../../../../../util/tokens';

import useContextMenuHandlers from '../../../../../hooks/useContextMenuHandlers';
import useLastCallback from '../../../../../hooks/useLastCallback';

export type MenuHandler = 'add' | 'send' | 'swap' | 'stake' | 'hide' | 'settings'
  | 'unstake' | 'stakeMore' | 'claimRewards';

function useTokenContextMenu(ref: ElementRef<HTMLButtonElement>, options: {
  isPortrait?: boolean;
  withContextMenu?: boolean;
  token: UserToken;
  isSwapDisabled?: boolean;
  isStakingAvailable?: boolean;
  isViewMode?: boolean;
  stakingState?: ApiStakingState;
}) {
  const {
    openReceiveModal,
    startTransfer,
    startSwap,
    startStaking,
    openSettingsWithState,
    toggleTokenVisibility,
    setLandscapeActionsActiveTabIndex,
    setReceiveActiveTab,
    startUnstaking,
    startStakingClaim,
  } = getActions();

  const {
    token,
    isPortrait,
    withContextMenu,
    isStakingAvailable,
    isSwapDisabled,
    isViewMode,
    stakingState,
  } = options;

  const {
    isContextMenuOpen, contextMenuAnchor,
    handleBeforeContextMenu, handleContextMenu,
    handleContextMenuClose, handleContextMenuHide,
  } = useContextMenuHandlers({
    elementRef: ref,
    isMenuDisabled: !withContextMenu,
  });
  const isServiceToken = getIsServiceToken(token);
  const stakingId = stakingState?.id;
  const isContextMenuShown = contextMenuAnchor !== undefined;
  const canBeClaimed = stakingState ? getStakingStateStatus(stakingState) === 'readyToClaim' : undefined;
  const hasUnclaimedRewards = stakingState?.type === 'jetton'
    ? !!stakingState.unclaimedRewards
    : undefined;

  const items: DropdownItem<MenuHandler>[] = useMemo(() => {
    const mandatoryItems: (false | DropdownItem<MenuHandler>)[] = [
      !stakingId && {
        name: 'Hide',
        fontIcon: 'eye-closed',
        value: 'hide',
      } satisfies DropdownItem<MenuHandler>, {
        name: 'Manage Tokens',
        fontIcon: 'menu-params',
        withDelimiter: !(isViewMode && stakingId),
        value: 'settings',
      } satisfies DropdownItem<MenuHandler>,
    ];

    if (isViewMode) {
      return compact(mandatoryItems);
    }

    const result: (false | undefined | DropdownItem<MenuHandler>)[] = stakingId
      ? [(stakingState?.type !== 'ethena' || !canBeClaimed) && {
        name: stakingState?.type === 'ethena' ? 'Request Unstaking' : 'Unstake',
        fontIcon: 'menu-send',
        value: 'unstake',
      } satisfies DropdownItem<MenuHandler>, {
        name: 'Stake More',
        fontIcon: 'menu-receive',
        value: 'stakeMore',
      } satisfies DropdownItem<MenuHandler>,
      (canBeClaimed || hasUnclaimedRewards) && {
        name: 'Claim Rewards',
        fontIcon: 'menu-gem',
        value: 'claimRewards',
      } satisfies DropdownItem<MenuHandler>]
      : [!isServiceToken && {
        name: 'Add / Buy',
        fontIcon: 'menu-plus',
        value: 'add',
      } satisfies DropdownItem<MenuHandler>, {
        name: 'Send',
        fontIcon: 'menu-send',
        value: 'send',
      } satisfies DropdownItem<MenuHandler>,
      !isSwapDisabled && {
        name: 'Swap',
        fontIcon: 'menu-swap',
        value: 'swap',
      } satisfies DropdownItem<MenuHandler>,
      isStakingAvailable && {
        name: 'Stake',
        fontIcon: 'menu-percent',
        value: 'stake',
      } satisfies DropdownItem<MenuHandler>];

    return compact(result.concat(mandatoryItems));
  }, [
    canBeClaimed, hasUnclaimedRewards, isStakingAvailable, isSwapDisabled, isViewMode,
    stakingId, stakingState?.type, isServiceToken,
  ]);

  const handleMenuItemSelect = useLastCallback((value: MenuHandler) => {
    void vibrate();

    switch (value) {
      case 'add':
        if (isPortrait) {
          openReceiveModal({ chain: token.chain });
        } else {
          setReceiveActiveTab({ chain: token.chain });
          setLandscapeActionsActiveTabIndex({ index: ActiveTab.Receive });
        }
        break;

      case 'send':
        startTransfer({
          isPortrait,
          tokenSlug: token.slug,
        });
        break;

      case 'swap':
        startSwap({
          tokenInSlug: token.slug,
          tokenOutSlug: token.slug === DEFAULT_SWAP_FIRST_TOKEN_SLUG
            ? DEFAULT_SWAP_SECOND_TOKEN_SLUG
            : DEFAULT_SWAP_FIRST_TOKEN_SLUG,
        });
        break;

      case 'stake':
      case 'stakeMore':
        startStaking({ tokenSlug: token.slug });
        break;

      case 'settings':
        openSettingsWithState({ state: SettingsState.Assets });
        break;

      case 'hide':
        toggleTokenVisibility({ slug: token.slug, shouldShow: false });
        break;

      case 'unstake':
        startUnstaking({ stakingId: stakingId! });
        break;

      case 'claimRewards':
        startStakingClaim({ stakingId: stakingId! });
        break;
    }

    handleContextMenuClose();
  });

  return {
    isContextMenuOpen,
    isContextMenuShown,
    contextMenuAnchor,
    items,
    isBackdropRendered: isPortrait && isContextMenuOpen,
    handleBeforeContextMenu,
    handleContextMenu,
    handleContextMenuClose,
    handleContextMenuHide,
    handleMenuItemSelect,
  };
}

export default useTokenContextMenu;
