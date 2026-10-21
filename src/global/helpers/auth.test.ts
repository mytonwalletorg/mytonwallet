import type { GlobalState } from '../types';

import { getGlobal } from '../index';
import { finalizeAccountCreation } from './auth';

jest.mock('../index', () => ({
  getActions: jest.fn(),
  getGlobal: jest.fn(),
  setGlobal: jest.fn(),
}));

jest.mock('../../api', () => ({
  callApi: jest.fn(),
}));

const CREATED_ACCOUNT_ID = '1-mainnet';

function createActions() {
  return { closeSettings: jest.fn(), switchToWallet: jest.fn(), showTokenActivity: jest.fn() } as any;
}

function setCurrentAccountId(accountId: string) {
  (getGlobal as jest.Mock).mockReturnValue({ currentTemporaryViewAccountId: accountId } as Partial<GlobalState>);
}

describe('finalizeAccountCreation', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('opens the token in the created account', () => {
    const actions = createActions();
    setCurrentAccountId(CREATED_ACCOUNT_ID);

    finalizeAccountCreation(actions, CREATED_ACCOUNT_ID, true, 300, 'toncoin');
    jest.runAllTimers();

    expect(actions.switchToWallet).toHaveBeenCalled();
    expect(actions.showTokenActivity).toHaveBeenCalledWith({ slug: 'toncoin' });
  });

  it('leaves another account that became current during the delay', () => {
    const actions = createActions();
    setCurrentAccountId(CREATED_ACCOUNT_ID);

    finalizeAccountCreation(actions, CREATED_ACCOUNT_ID, true, 300, 'toncoin');
    setCurrentAccountId('2-mainnet');
    jest.runAllTimers();

    expect(actions.switchToWallet).not.toHaveBeenCalled();
    expect(actions.showTokenActivity).not.toHaveBeenCalled();
  });
});
