import './initial';

import type { ApiNft } from '../../../api/types';
import type { ApiUpdate } from '../../../api/types/updates';
import type { GlobalState } from '../../types';

import { addActionHandler, setGlobal } from '../../index';

jest.mock('../../index', () => ({
  addActionHandler: jest.fn(),
  getGlobal: jest.fn(),
  setGlobal: jest.fn(),
}));

type ApiUpdateHandler = (
  global: GlobalState,
  actions: AnyLiteral,
  update: ApiUpdate,
) => void;

function getApiUpdateHandler() {
  const call = (addActionHandler as jest.Mock).mock.calls.find(([name]) => name === 'apiUpdate');
  return call![1] as ApiUpdateHandler;
}

function makeGlobal(currentAccountId: string): GlobalState {
  const account = { title: 'Test', type: 'mnemonic', byChain: {} };
  const accountIds = ['0-mainnet', '0-testnet'];
  return {
    currentAccountId,
    accounts: { byId: Object.fromEntries(accountIds.map((id) => [id, account])) },
    byAccountId: Object.fromEntries(accountIds.map((id) => [id, {}])),
    settings: {
      byAccountId: Object.fromEntries(accountIds.map((id) => [id, {}])),
      orderedAccountIds: accountIds,
    },
    pushNotifications: { enabledAccounts: [] },
  } as unknown as GlobalState;
}

describe('updateNfts api update', () => {
  const ACCOUNT_ID = '0-mainnet';
  const NFT_ADDRESS = 'EQAglL_g6q2AhMK_BT9jN1F-8jBlv2pOI30vRkPluU9kcXgV';

  function makeNft(partial: Partial<ApiNft> = {}): ApiNft {
    return {
      chain: 'ton',
      interface: 'default',
      index: 0,
      address: NFT_ADDRESS,
      isOnSale: false,
      metadata: {},
      ...partial,
    };
  }

  function dispatchUpdateNfts(global: GlobalState, nfts: ApiNft[], isFullLoading?: boolean) {
    getApiUpdateHandler()(global, {}, {
      type: 'updateNfts', accountId: ACCOUNT_ID, chain: 'ton', nfts, isFullLoading,
    });
    const [updatedGlobal] = (setGlobal as jest.Mock).mock.calls.at(-1)!;
    return (updatedGlobal as GlobalState).byAccountId[ACCOUNT_ID].nfts!.byAddress![NFT_ADDRESS];
  }

  beforeEach(() => {
    (setGlobal as jest.Mock).mockClear();
  });

  it('drops a stale unverified flag when the collection has become trusted', () => {
    const global = makeGlobal(ACCOUNT_ID);
    global.byAccountId[ACCOUNT_ID].nfts = {
      byAddress: { [NFT_ADDRESS]: makeNft({ isUnverified: true }) },
      orderedAddresses: [NFT_ADDRESS],
    };

    expect(dispatchUpdateNfts(global, [makeNft()], true).isUnverified).toBeUndefined();
  });

  it('keeps the unverified flag while the incoming batch still reports it', () => {
    const global = makeGlobal(ACCOUNT_ID);
    global.byAccountId[ACCOUNT_ID].nfts = {
      byAddress: { [NFT_ADDRESS]: makeNft({ isUnverified: true }) },
      orderedAddresses: [NFT_ADDRESS],
    };

    expect(dispatchUpdateNfts(global, [makeNft({ isUnverified: true })], true).isUnverified).toBe(true);
  });

  it('keeps the stored NFT data that the batch has no fresher version of', () => {
    const global = makeGlobal(ACCOUNT_ID);
    global.byAccountId[ACCOUNT_ID].nfts = {
      byAddress: { [NFT_ADDRESS]: makeNft({ isOnSale: true, name: 'From socket' }) },
      orderedAddresses: [NFT_ADDRESS],
    };

    const nft = dispatchUpdateNfts(global, [makeNft({ isOnSale: false, name: 'From batch' })], true);

    expect(nft).toMatchObject({ isOnSale: true, name: 'From socket' });
  });
});

describe('removeAccounts api update', () => {
  beforeEach(() => {
    (setGlobal as jest.Mock).mockClear();
  });

  function dispatchRemoveAccounts(global: GlobalState, accountIds: string[]) {
    const actions = { switchAccount: jest.fn() };
    getApiUpdateHandler()(global, actions, { type: 'removeAccounts', accountIds });
    const [updatedGlobal] = (setGlobal as jest.Mock).mock.calls.at(-1)!;
    return { actions, updatedGlobal: updatedGlobal as GlobalState };
  }

  it('re-selects a surviving account when the removed one was current', () => {
    const { actions, updatedGlobal } = dispatchRemoveAccounts(makeGlobal('0-testnet'), ['0-testnet']);

    expect(updatedGlobal.byAccountId).not.toHaveProperty('0-testnet');
    expect(actions.switchAccount).toHaveBeenCalledWith({ accountId: '0-mainnet', newNetwork: 'mainnet' });
  });

  it('skips a stale ordered id that no longer has an account when picking the survivor', () => {
    const global = makeGlobal('0-testnet');
    // `orderedAccountIds` retains a ghost id from an account removed in an earlier session (never cleaned there).
    global.settings.orderedAccountIds = ['9-mainnet', '0-mainnet', '0-testnet'];

    const { actions } = dispatchRemoveAccounts(global, ['0-testnet']);

    expect(actions.switchAccount).toHaveBeenCalledWith({ accountId: '0-mainnet', newNetwork: 'mainnet' });
  });

  it('does not switch when the current account survives', () => {
    const { actions, updatedGlobal } = dispatchRemoveAccounts(makeGlobal('0-mainnet'), ['0-testnet']);

    expect(updatedGlobal.currentAccountId).toBe('0-mainnet');
    expect(actions.switchAccount).not.toHaveBeenCalled();
  });

  it('leaves no account selected after a full wipe', () => {
    const { actions, updatedGlobal } = dispatchRemoveAccounts(
      makeGlobal('0-testnet'),
      ['0-mainnet', '0-testnet'],
    );

    expect(updatedGlobal.currentAccountId).toBeUndefined();
    expect(actions.switchAccount).not.toHaveBeenCalled();
  });
});

describe('updateConfig api update', () => {
  beforeEach(() => {
    (setGlobal as jest.Mock).mockClear();
  });

  function dispatchUpdateConfig(global: GlobalState) {
    getApiUpdateHandler()(global, {}, {
      type: 'updateConfig',
      isLimited: false,
      isCopyStorageEnabled: false,
      isAppUpdateRequired: false,
    } as ApiUpdate);
    const [updatedGlobal] = (setGlobal as jest.Mock).mock.calls.at(-1)!;
    return updatedGlobal as GlobalState;
  }

  it('clears a stale isNftBuyingDisabled persisted by an older build', () => {
    const global = {
      restrictions: { isNftBuyingDisabled: true },
      settings: { byAccountId: {} },
    } as unknown as GlobalState;

    const updatedGlobal = dispatchUpdateConfig(global);

    expect(updatedGlobal.restrictions.isNftBuyingDisabled).toBe(false);
  });
});
