import type { ConnectEventError, ConnectItemReply, DeviceInfo } from '@tonconnect/protocol';

export interface LocalConnectEventSuccess {
  event: 'connect';
  id: number;
  payload: {
    items: ConnectItemReply[];
    device?: DeviceInfo; // We add it later in contentScript.js
  };
}

export interface TransactionPayload {
  valid_until?: number;
  messages: TransactionPayloadMessage[];
}

export interface TransactionPayloadMessage {
  address: string;
  amount: string;
  payload?: string;
  stateInit?: string;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export enum CONNECT_EVENT_ERROR_CODES {
  UNKNOWN_ERROR = 0,
  BAD_REQUEST_ERROR = 1,
  MANIFEST_NOT_FOUND_ERROR = 2,
  MANIFEST_CONTENT_ERROR = 3,
  UNKNOWN_APP_ERROR = 100,
  USER_REJECTS_ERROR = 300,
  METHOD_NOT_SUPPORTED = 400,
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export enum SEND_TRANSACTION_ERROR_CODES {
  UNKNOWN_ERROR = 0,
  BAD_REQUEST_ERROR = 1,
  UNKNOWN_APP_ERROR = 100,
  USER_REJECTS_ERROR = 300,
  METHOD_NOT_SUPPORTED = 400,
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export enum SIGN_DATA_ERROR_CODES {
  UNKNOWN_ERROR = 0,
  BAD_REQUEST_ERROR = 1,
  UNKNOWN_APP_ERROR = 100,
  USER_REJECTS_ERROR = 300,
  METHOD_NOT_SUPPORTED = 400,
}

export type AllErrorCodes = CONNECT_EVENT_ERROR_CODES | SEND_TRANSACTION_ERROR_CODES | SIGN_DATA_ERROR_CODES;
export type LocalConnectEvent = LocalConnectEventSuccess | ConnectEventError;

export interface ApiTonConnectProof {
  timestamp: number;
  domain: string;
  payload: string;
}
