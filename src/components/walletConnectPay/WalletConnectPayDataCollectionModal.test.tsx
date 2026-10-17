import React from '../../lib/teact/teact';
import TeactDOM from '../../lib/teact/teact-dom';

import { pause } from '../../util/schedulers';

import WalletConnectPayDataCollectionModal from './WalletConnectPayDataCollectionModal';

const mockShowError = jest.fn();
const mockCloseDataCollection = jest.fn();

jest.mock('../../global', () => ({
  ...jest.requireActual('../../global'),
  getActions: () => ({
    showError: mockShowError,
    closeWalletConnectPayDataCollection: mockCloseDataCollection,
    completeWalletConnectPayDataCollection: jest.fn(),
  }),
  withGlobal: () => (Component: unknown) => Component,
}));
jest.mock('../../util/windowEnvironment', () => ({
  ...jest.requireActual('../../util/windowEnvironment'),
  IS_ELECTRON: true,
}));
jest.mock('../../hooks/useLang', () => ({
  __esModule: true,
  default: () => Object.assign((key: string) => key, { code: 'en' }),
}));
jest.mock('../ui/Modal', () => ({
  __esModule: true,
  default: () => undefined,
}));

const COLLECT_URL = 'https://pay.walletconnect.com/collect';
const IPC_ERROR_PREFIX = 'Error invoking remote method \'open-wallet-connect-pay-collect\': Error: ';

describe('WalletConnectPayDataCollectionModal in Electron', () => {
  let root: HTMLDivElement;

  beforeEach(() => {
    root = document.createElement('div');
    document.body.appendChild(root);
  });

  afterEach(() => {
    TeactDOM.render(undefined, root);
    root.remove();
    window.electron = undefined;
    jest.clearAllMocks();
  });

  async function renderWithCollectRejection(message: string) {
    window.electron = {
      openWalletConnectPayCollect: jest.fn().mockRejectedValue(new Error(`${IPC_ERROR_PREFIX}${message}`)),
      closeWalletConnectPayCollect: jest.fn(),
    };

    TeactDOM.render(<WalletConnectPayDataCollectionModal promiseId="1" url={COLLECT_URL} />, root);
    await pause(20);
  }

  it('closes silently when the user cancels the collect window', async () => {
    await renderWithCollectRejection('Canceled by the user');

    expect(mockShowError).not.toHaveBeenCalled();
    expect(mockCloseDataCollection).toHaveBeenCalledTimes(1);
  });

  it('shows other errors without the IPC prefix', async () => {
    await renderWithCollectRejection('Failed to load');

    expect(mockShowError).toHaveBeenCalledWith({ error: 'Failed to load' });
    expect(mockCloseDataCollection).toHaveBeenCalledTimes(1);
  });
});
