import {
  AppRequest,
  CONNECT_EVENT_ERROR_CODES,
  ConnectEvent,
  ConnectEventError,
  ConnectRequest,
  DeviceInfo,
  DisconnectEvent,
  RpcMethod,
  RpcRequests,
  WalletEvent,
  WalletResponse,
} from '@tonconnect/protocol';

import packageJson from '../../../package.json';
import { Connector } from '../../util/PostMessageConnector';

type TonConnectCallback = (event: WalletEvent) => void;
type AppMethodMessage = AppRequest<keyof RpcRequests>;
type WalletMethodMessage = WalletResponse<RpcMethod>;
type RequestMethods = 'connect'
| 'reconnect'
| 'disconnect'
| keyof RpcRequests
| 'deactivate';

interface TonConnectBridge {
  deviceInfo: DeviceInfo; // see Requests/Responses spec
  protocolVersion: number; // max supported Ton Connect version (e.g. 2)
  isWalletBrowser: boolean; // if the page is opened into wallet's browser
  connect(protocolVersion: number, message: ConnectRequest): Promise<ConnectEvent>;
  disconnect(): Promise<DisconnectEvent>;
  restoreConnection(): Promise<ConnectEvent>;
  send(message: AppMethodMessage): Promise<WalletMethodMessage>;
  listen(callback: TonConnectCallback): () => void;
}

type DevicePlatform = DeviceInfo['platform'];

const TONCONNECT_VERSION = 2;

function getDeviceInfo(): DeviceInfo {
  return {
    platform: getPlatform()!,
    appName: 'MyTonWallet',
    appVersion: packageJson.version,
    maxProtocolVersion: TONCONNECT_VERSION,
    features: ['SendTransaction'],
  };
}

function getPlatform(): DevicePlatform {
  const { userAgent, platform } = window.navigator;

  const macosPlatforms = ['macOS', 'Macintosh', 'MacIntel', 'MacPPC', 'Mac68K'];
  const windowsPlatforms = ['Win32', 'Win64', 'Windows', 'WinCE'];
  const iphonePlatforms = ['iPhone'];
  const ipadPlatforms = ['iPad', 'iPod'];

  let os: DevicePlatform | undefined;

  if (macosPlatforms.indexOf(platform) !== -1) {
    os = 'mac';
  } else if (iphonePlatforms.indexOf(platform) !== -1) {
    os = 'iphone';
  } else if (ipadPlatforms.indexOf(platform) !== -1) {
    os = 'ipad';
  } else if (windowsPlatforms.indexOf(platform) !== -1) {
    os = 'windows';
  } else if (/Android/.test(userAgent)) {
    os = 'linux';
  } else if (/Linux/.test(platform)) {
    os = 'linux';
  }

  return os!;
}

export class TonConnect implements TonConnectBridge {
  deviceInfo: DeviceInfo = getDeviceInfo();

  protocolVersion = TONCONNECT_VERSION;

  isWalletBrowser = false;

  private connector: Connector;

  private callbacks: Array<(event: WalletEvent) => void>;

  constructor(connector: Connector) {
    this.connector = connector;
    this.callbacks = [];
  }

  async connect(protocolVersion: number, message: ConnectRequest): Promise<ConnectEvent> {
    if (protocolVersion > this.protocolVersion) {
      return TonConnect.buildError(
        'Unsupported protocol version',
        CONNECT_EVENT_ERROR_CODES.BAD_REQUEST_ERROR,
      );
    }

    const response = await this.request('connect', [message]);
    if (response?.event === 'connect') {
      response.payload.device = getDeviceInfo();

      this.addEventListeners();
    }

    return this.emit<ConnectEvent>(response || TonConnect.buildError());
  }

  async restoreConnection(): Promise<ConnectEvent> {
    const response = await this.request('reconnect');
    if (response?.event === 'connect') {
      response.payload.device = getDeviceInfo();

      this.addEventListeners();
    }

    return this.emit<ConnectEvent>(response || TonConnect.buildError());
  }

  async disconnect() {
    await this.request('disconnect');

    this.removeEventListeners();

    return this.emit<DisconnectEvent>({
      event: 'disconnect',
      payload: {},
    });
  }

  async send(message: AppMethodMessage) {
    const response = await this.request(message.method, [message]);
    return response || TonConnect.buildError(
      'Unknown app error',
      CONNECT_EVENT_ERROR_CODES.UNKNOWN_APP_ERROR,
    );
  }

  listen(callback: (event: WalletEvent) => void): (() => void) {
    this.callbacks.push(callback);
    return () => {
      this.callbacks = this.callbacks.filter((cb) => cb !== callback);
    };
  }

  private request(name: RequestMethods, args: any[] = []) {
    return this.connector.request({ name: `tonConnect_${name}`, args });
  }

  private static buildError(msg = 'Unknown error', code?: CONNECT_EVENT_ERROR_CODES): ConnectEventError {
    return {
      event: 'connect_error',
      payload: {
        code: code || CONNECT_EVENT_ERROR_CODES.UNKNOWN_ERROR,
        message: msg,
      },
    };
  }

  private emit<E extends WalletEvent>(event: E): E {
    this.callbacks.forEach((cb) => cb(event));
    return event;
  }

  private addEventListeners() {
    this.removeEventListeners();

    window.addEventListener('beforeunload', this.unloadEventListener);
  }

  private removeEventListeners() {
    window.removeEventListener('beforeunload', this.unloadEventListener);
  }

  private unloadEventListener = () => {
    void this.request('deactivate');
  };

  private destroy() {
    this.removeEventListeners();
    this.callbacks = [];
    this.connector.destroy();
  }
}
