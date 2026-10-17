import './dapps';
import '../ui/dapps';

import type { GlobalState } from '../../types';
import { DappConnectState, SignDataState, TransferState } from '../../types';

import { callApi } from '../../../api';
import {
  clearAbortDappConnectWalletCreation,
  peekAbortDappConnectWalletCreation,
} from '../../helpers/abortDappConnectWalletCreation';
import { addActionHandler, getActions, getGlobal, setGlobal } from '../../index';

jest.mock('../../../api', () => ({
  callApi: jest.fn(),
}));

jest.mock('../../../util/schedulers', () => ({
  ...jest.requireActual('../../../util/schedulers'),
  pause: () => Promise.resolve(),
}));

async function waitFor(condition: () => boolean) {
  for (let i = 0; i < 100 && !condition(); i++) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe('dapp request updates', () => {
  // The real handlers live in action modules this test does not load
  addActionHandler('addSiteToBrowserHistory', jest.fn());
  addActionHandler('closeSettings', jest.fn());

  function setRequests(requests: Partial<Pick<GlobalState, 'currentDappTransfer' | 'currentDappSignData'>>) {
    const base = getGlobal();
    setGlobal({
      ...base,
      currentDappTransfer: { state: TransferState.None },
      currentDappSignData: { state: SignDataState.None },
      ...requests,
    } as GlobalState);
  }

  it('closes a loading skeleton', () => {
    setRequests({ currentDappTransfer: { state: TransferState.Initial, isSse: true } });

    getActions().apiUpdateDappCloseLoading({ type: 'dappCloseLoading', connectionType: 'sendTransaction' });

    expect(getGlobal().currentDappTransfer.state).toBe(TransferState.None);
  });

  it('keeps a filled request when another request fails to load', () => {
    setRequests({ currentDappSignData: { state: SignDataState.Initial, promiseId: 'open-request' } });

    getActions().apiUpdateDappCloseLoading({ type: 'dappCloseLoading', connectionType: 'signData' });

    expect(getGlobal().currentDappSignData.promiseId).toBe('open-request');
  });

  it('does not reset the screen of a filled request when another request starts loading', () => {
    setRequests({ currentDappTransfer: { state: TransferState.Password, promiseId: 'open-request' } });

    getActions().apiUpdateDappLoading({
      type: 'dappLoading',
      connectionType: 'sendTransaction',
      isSse: true,
    });

    expect(getGlobal().currentDappTransfer).toMatchObject({
      state: TransferState.Password,
      promiseId: 'open-request',
    });
  });

  it('cancels the replaced request when its close animation ends after the new one arrived', () => {
    setRequests({ currentDappTransfer: { state: TransferState.Initial, promiseId: 'new-request' } });

    getActions().cancelDappTransfer({ promiseId: 'replaced-request' });

    expect(callApi).toHaveBeenCalledWith('cancelDappRequest', 'replaced-request', expect.any(String));
    expect(callApi).not.toHaveBeenCalledWith('cancelDappRequest', 'new-request', expect.anything());
    expect(getGlobal().currentDappTransfer.promiseId).toBe('new-request');
  });

  it('rejects an open connect request when a newer one arrives', () => {
    const base = getGlobal();
    setGlobal({
      ...base,
      dappConnectRequest: { state: DappConnectState.Info, promiseId: 'open-request' },
    } as GlobalState);

    getActions().apiUpdateDappConnect({
      type: 'dappConnect',
      identifier: 'request',
      promiseId: 'new-request',
      accountId: '0-mainnet',
      dapp: { url: 'https://dapp.example' },
      permissions: { address: true, proof: false },
    } as any);

    expect(callApi).toHaveBeenCalledWith('cancelDappRequest', 'open-request', expect.any(String));
    expect(getGlobal().dappConnectRequest?.promiseId).toBe('new-request');
  });

  it('rejects every replaced request when two arrive while the first is still being switched to', async () => {
    setRequests({ currentDappSignData: { state: SignDataState.Initial, promiseId: 'open-request' } });
    setGlobal({
      ...getGlobal(),
      currentAccountId: '0-mainnet',
      accounts: { byId: { '0-mainnet': { type: 'mnemonic', title: 'Wallet', byChain: { ton: { address: 'UQ1' } } } } },
    } as unknown as GlobalState);
    const receiveSignData = (promiseId: string) => getActions().apiUpdateDappSignData({
      type: 'dappSignData',
      promiseId,
      accountId: '0-mainnet',
      dapp: { url: 'https://dapp.example' },
      operationChain: 'ton',
      payloadToSign: { type: 'text', text: 'Hello' },
    } as any);

    receiveSignData('first-request');
    receiveSignData('second-request');
    await waitFor(() => getGlobal().currentDappSignData.promiseId === 'second-request');

    expect(getGlobal().currentDappSignData.promiseId).toBe('second-request');
    expect(callApi).toHaveBeenCalledWith('cancelDappRequest', 'open-request', expect.any(String));
    expect(callApi).toHaveBeenCalledWith('cancelDappRequest', 'first-request', expect.any(String));
  });

  it('aborts the wallet creation of a connect request that a newer one replaces', () => {
    clearAbortDappConnectWalletCreation();
    setGlobal({
      ...getGlobal(),
      dappConnectRequest: { state: DappConnectState.Info, promiseId: 'open-request', isCreatingAccount: true },
    } as GlobalState);

    getActions().apiUpdateDappConnect({
      type: 'dappConnect',
      identifier: 'request',
      promiseId: 'new-request',
      accountId: '0-mainnet',
      dapp: { url: 'https://dapp.example' },
      permissions: { address: true, proof: false },
    } as any);

    expect(peekAbortDappConnectWalletCreation()).toBe(true);
    clearAbortDappConnectWalletCreation();
  });

  it('keeps the wallet creation of a connect request when a replaced one finishes closing', () => {
    clearAbortDappConnectWalletCreation();
    setGlobal({
      ...getGlobal(),
      dappConnectRequest: { state: DappConnectState.Info, promiseId: 'new-request', isCreatingAccount: true },
    } as GlobalState);

    getActions().cancelDappConnectRequestConfirm({ promiseId: 'replaced-request' });

    expect(peekAbortDappConnectWalletCreation()).toBe(false);
    expect(callApi).toHaveBeenCalledWith('cancelDappRequest', 'replaced-request', expect.any(String));
    expect(getGlobal().dappConnectRequest?.promiseId).toBe('new-request');
  });

  it('aborts the wallet creation of the connect request being canceled', () => {
    clearAbortDappConnectWalletCreation();
    setGlobal({
      ...getGlobal(),
      dappConnectRequest: { state: DappConnectState.Info, promiseId: 'open-request', isCreatingAccount: true },
    } as GlobalState);

    getActions().cancelDappConnectRequestConfirm({ promiseId: 'open-request' });

    expect(peekAbortDappConnectWalletCreation()).toBe(true);
    clearAbortDappConnectWalletCreation();
  });

  it('keeps the skeleton of a loading request when the replaced one finishes closing', () => {
    setRequests({ currentDappTransfer: { state: TransferState.Initial, isSse: true } });

    getActions().cancelDappTransfer({ promiseId: 'replaced-request' });

    expect(callApi).toHaveBeenCalledWith('cancelDappRequest', 'replaced-request', expect.any(String));
    expect(getGlobal().currentDappTransfer.state).toBe(TransferState.Initial);
  });
});
