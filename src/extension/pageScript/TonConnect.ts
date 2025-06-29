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

import type { Connector } from '../../util/PostMessageConnector';

import { TONCONNECT_PROTOCOL_VERSION, TONCONNECT_WALLET_JSBRIDGE_KEY } from '../../config';
import { tonConnectGetDeviceInfo } from '../../util/tonConnectEnvironment';

declare global {
  interface Window {
    mytonwallet: {
      tonconnect: TonConnect;
    };
    tonwallet: {
      tonconnect: TonConnect;
    };
  }
}

// This is imported from @tonconnect/protocol library

enum CONNECT_EVENT_ERROR_CODES {
  UNKNOWN_ERROR = 0,
  BAD_REQUEST_ERROR = 1,
  MANIFEST_NOT_FOUND_ERROR = 2,
  MANIFEST_CONTENT_ERROR = 3,
  UNKNOWN_APP_ERROR = 100,
  USER_REJECTS_ERROR = 300,
  METHOD_NOT_SUPPORTED = 400,
}

type TonConnectCallback = (event: WalletEvent) => void;
type AppMethodMessage = AppRequest<keyof RpcRequests>;
type WalletMethodMessage = WalletResponse<RpcMethod>;
type RequestMethods = 'connect' | 'reconnect' | keyof RpcRequests;

export interface ExtensionTonConnectBridge {
  deviceInfo: DeviceInfo; // see Requests/Responses spec
  protocolVersion: number; // max supported Ton Connect version (e.g. 2)
  isWalletBrowser: boolean; // if the page is opened into wallet's browser
  connect(protocolVersion: number, message: ConnectRequest): Promise<ConnectEvent>;

  restoreConnection(): Promise<ConnectEvent>;

  send(message: AppMethodMessage): Promise<WalletMethodMessage>;

  listen(callback: TonConnectCallback): () => void;
}

class TonConnect implements ExtensionTonConnectBridge {
  deviceInfo: DeviceInfo = tonConnectGetDeviceInfo();

  protocolVersion = TONCONNECT_PROTOCOL_VERSION;

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
    return this.emit<ConnectEvent>(response || TonConnect.buildConnectError(id));
  }

  async restoreConnection(): Promise<ConnectEvent> {
    const id = ++this.lastGeneratedId;
    const response = await this.request('reconnect', [id]);
    return this.emit<ConnectEvent>(response || TonConnect.buildConnectError(id));
  }

  async send(message: AppMethodMessage) {
    const { id } = message;
    const response = await this.request(message.method, [message]);

    return response || {
      error: {
        code: 0,
        message: 'Unknown error.',
      },
      id,
    };
  }

  disconnect() {
    return this.send({
      method: 'disconnect',
      params: [],
      id: '0',
    });
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
  }

  private request(name: RequestMethods, args: any[] = []) {
    return this.apiConnector.request({ name: `tonConnect_${name}`, args });
  }

  private static buildConnectError(
    id: number,
    msg = 'Unknown error.',
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

  private destroy() {
    this.callbacks = [];
    this.apiConnector.destroy();
  }
}

export function initTonConnect(apiConnector: Connector) {
  const tonConnect = new TonConnect(apiConnector);

  window[TONCONNECT_WALLET_JSBRIDGE_KEY] = {
    tonconnect: tonConnect,
  };

  return tonConnect;
}
