export enum ElectronEvent {
  DEEPLINK = 'deeplink',
  DEEPLINK_TONCONNECT = 'deeplink-tonconnect',
  UPDATE_ERROR = 'update-error',
  UPDATE_AVAILABLE = 'update-available',
  UPDATE_DOWNLOAD_PROGRESS = 'update-download-progress',
  UPDATE_DOWNLOADED = 'update-downloaded',
}

export enum ElectronAction {
  CLOSE = 'close',
  MINIMIZE = 'minimize',
  MAXIMIZE = 'maximize',
  UNMAXIMIZE = 'unmaximize',
  GET_IS_MAXIMIZED = 'get-is-maximized',

  DOWNLOAD_UPDATE = 'download-update',
  INSTALL_UPDATE = 'install-update',
  CANCEL_UPDATE = 'cancel-update',
  HANDLE_DOUBLE_CLICK = 'handle-double-click',

  TOGGLE_DEEPLINK_HANDLER = 'toggle-deeplink-handler',
}

export interface ElectronApi {
  close: VoidFunction;
  minimize: VoidFunction;
  maximize: VoidFunction;
  unmaximize: VoidFunction;
  getIsMaximized: () => Promise<boolean>;

  downloadUpdate: () => Promise<void>;
  cancelUpdate: () => Promise<void>;
  installUpdate: () => Promise<void>;
  handleDoubleClick: () => Promise<void>;

  toggleDeeplinkHandler: (isEnabled: boolean) => Promise<void>;

  on: (eventName: ElectronEvent, callback: any) => VoidFunction;
}

declare global {
  interface Window {
    electron?: ElectronApi;
  }
}
