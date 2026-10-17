import getElectronIpcErrorMessage from './getElectronIpcErrorMessage';

it('strips the prefix Electron adds to errors rethrown by `ipcRenderer.invoke`', () => {
  const error = new Error(
    'Error invoking remote method \'open-wallet-connect-pay-collect\': Error: Canceled by the user',
  );

  expect(getElectronIpcErrorMessage(error)).toBe('Canceled by the user');
});

it('keeps messages without the prefix', () => {
  expect(getElectronIpcErrorMessage(new Error('Failed to load'))).toBe('Failed to load');
  expect(getElectronIpcErrorMessage('Unknown error')).toBe('Unknown error');
});
