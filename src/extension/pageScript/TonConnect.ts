import type {
  AppRequest,
  ConnectEvent,
  ConnectEventError,
  ConnectRequest,
  DeviceInfo,
  RpcMethod,
  RpcRequests,
  WalletEvent,
  WalletResponse,
} from '@tonconnect/protocol';
import {
  CONNECT_EVENT_ERROR_CODES,
} from '@tonconnect/protocol';

import type { Connector } from '../../util/PostMessageConnector';
import { TONCONNECT_VERSION, tonConnectGetDeviceInfo } from '../../util/tonConnectEnvironment';

declare global {
  interface Window {
    mytonwallet: {
      tonconnect: TonConnect;
    };
  }
}

type TonConnectCallback = (event: WalletEvent) => void;
type AppMethodMessage = AppRequest<keyof RpcRequests>;
type WalletMethodMessage = WalletResponse<RpcMethod>;
type RequestMethods = 'connect' | 'reconnect' | keyof RpcRequests | 'deactivate';

interface TonConnectBridge {
  deviceInfo: DeviceInfo; // see Requests/Responses spec
  protocolVersion: number; // max supported Ton Connect version (e.g. 2)
  isWalletBrowser: boolean; // if the page is opened into wallet's browser
  connect(protocolVersion: number, message: ConnectRequest): Promise<ConnectEvent>;

  restoreConnection(): Promise<ConnectEvent>;

  send(message: AppMethodMessage): Promise<WalletMethodMessage>;

  listen(callback: TonConnectCallback): () => void;
}

class TonConnect implements TonConnectBridge {
  deviceInfo: DeviceInfo = tonConnectGetDeviceInfo();

  protocolVersion = TONCONNECT_VERSION;

  isWalletBrowser = false;

  private callbacks: Array<(event: WalletEvent) => void>;

  private lastGeneratedId: number = 0;

  constructor(private apiConnector: Connector) {
    this.callbacks = [];
  }

  async connect(protocolVersion: number, message: ConnectRequest): Promise<ConnectEvent> {
    const id = ++this.lastGeneratedId;

    if (protocolVersion > this.protocolVersion) {
      return TonConnect.buildConnectError(
        id,
        'Unsupported protocol version',
        CONNECT_EVENT_ERROR_CODES.BAD_REQUEST_ERROR,
      );
    }

    const response = await this.request('connect', [message, id]);
    if (response?.event === 'connect') {
      response.payload.device = tonConnectGetDeviceInfo();

      this.addEventListeners();
    }

    return this.emit<ConnectEvent>(response || TonConnect.buildConnectError(id));
  }

  async restoreConnection(): Promise<ConnectEvent> {
    const id = ++this.lastGeneratedId;

    const response = await this.request('reconnect', [id]);
    if (response?.event === 'connect') {
      response.payload.device = tonConnectGetDeviceInfo();

      this.addEventListeners();
    }

    return this.emit<ConnectEvent>(response || TonConnect.buildConnectError(id));
  }

  async send(message: AppMethodMessage) {
    const { id } = message;
    const response = await this.request(message.method, [message]);

    if (message.method === 'disconnect') {
      this.removeEventListeners();
    }

    return response || {
      error: {
        code: 0,
        message: 'Unknown error',
      },
      id,
    };
  }

  listen(callback: (event: WalletEvent) => void): (() => void) {
    this.callbacks.push(callback);
    return () => {
      this.callbacks = this.callbacks.filter((cb) => cb !== callback);
    };
  }

  onDisconnect() {
    const id = ++this.lastGeneratedId;

    this.emit({
      event: 'disconnect',
      id,
      payload: {},
    });

    this.removeEventListeners();
  }

  private request(name: RequestMethods, args: any[] = []) {
    return this.apiConnector.request({ name: `tonConnect_${name}`, args });
  }

  private static buildConnectError(
    id: number,
    msg = 'Unknown error',
    code?: CONNECT_EVENT_ERROR_CODES,
  ): ConnectEventError {
    return {
      event: 'connect_error',
      id,
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
    this.apiConnector.destroy();
  }
}

export function initTonConnect(apiConnector: Connector) {
  const tonConnect = new TonConnect(apiConnector);

  window.mytonwallet = {
    tonconnect: tonConnect,
  };

  return tonConnect;
}
