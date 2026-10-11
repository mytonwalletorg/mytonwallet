import type { Account, GlobalState } from '../types';

import { selectHasAuth, selectHasPassword } from './accounts';

const MNEMONIC_ACCOUNT = { title: 'Wallet', type: 'mnemonic', byChain: {} } as unknown as Account;
const VIEW_ACCOUNT = { title: 'Wallet', type: 'view', byChain: {} } as unknown as Account;

function buildGlobal(accounts: Record<string, Account>, authTypes?: GlobalState['authTypes']): GlobalState {
  return {
    authTypes,
    currentAccountId: Object.keys(accounts)[0],
    settings: { isTestnet: false },
    accounts: { byId: accounts },
  } as unknown as GlobalState;
}

describe('auth-state selectors', () => {
  it('sees no password in an empty wallet', () => {
    const global = buildGlobal({});

    expect(selectHasAuth(global)).toBe(false);
    expect(selectHasPassword(global)).toBe(false);
  });

  it('sees a password once the Enclave is provisioned', () => {
    const global = buildGlobal({ '0-mainnet': MNEMONIC_ACCOUNT }, ['passcode']);

    expect(selectHasAuth(global)).toBe(true);
    expect(selectHasPassword(global)).toBe(true);
  });

  it('sees no password in a view-only wallet', () => {
    const global = buildGlobal({ '0-mainnet': VIEW_ACCOUNT });

    expect(selectHasPassword(global)).toBe(false);
  });
});
