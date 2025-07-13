import { BottomSheet } from '@mytonwallet/native-bottom-sheet';
import type {
  AppRequest,
  ConnectEvent,
  ConnectEventError,
  ConnectRequest,
  RpcMethod,
  WalletResponse,
} from '@tonconnect/protocol';
import { getActions, getGlobal } from '../../../global';

import { CONNECT_EVENT_ERROR_CODES, SEND_TRANSACTION_ERROR_CODES } from '../../../api/tonConnect/types';

import { TONCONNECT_PROTOCOL_VERSION } from '../../../config';
import { callApi } from '../../../api';
import { logDebugError } from '../../logs';
import { IS_DELEGATED_BOTTOM_SHEET } from '../../windowEnvironment';

export interface BrowserTonConnectBridgeMethods {
  connect(protocolVersion: number, message: ConnectRequest): Promise<ConnectEvent>;

  restoreConnection(): Promise<ConnectEvent>;

  disconnect(): Promise<void>;

  send<T extends RpcMethod>(message: AppRequest<T>): Promise<WalletResponse<T>>;
}

let requestId = 0;

export function buildTonConnectBridgeApi(pageUrl: string): BrowserTonConnectBridgeMethods | undefined {
  const {
    openLoadingOverlay,
    closeLoadingOverlay,
  } = getActions();

  const url = new URL(pageUrl).origin.toLowerCase();

  return {
    connect: async (protocolVersion, request) => {
      try {
        if (protocolVersion > TONCONNECT_PROTOCOL_VERSION) {
          return buildConnectError(
            requestId,
            'Unsupported protocol version',
            CONNECT_EVENT_ERROR_CODES.BAD_REQUEST_ERROR,
          );
        }
        verifyConnectRequest(request);

        openLoadingOverlay();

        const response = await callApi(
          'tonConnect_connect',
          buildDappRequest(url),
          request,
          requestId,
        );

        closeLoadingOverlay();

        requestId++;

        return response;
      } catch (err: any) {
        logDebugError('useDAppBridge:connect', err);

        if ('event' in err && 'id' in err && 'payload' in err) {
          return err;
        }

        return buildConnectError(
          requestId,
          err?.message,
          CONNECT_EVENT_ERROR_CODES.UNKNOWN_ERROR,
        );
      }
    },

    restoreConnection: async () => {
      try {
        const response = await callApi(
          'tonConnect_reconnect',
          buildDappRequest(url),
          requestId,
        );

        requestId++;

        return response;
      } catch (err: any) {
        logDebugError('useDAppBridge:reconnect', err);

        if ('event' in err && 'id' in err && 'payload' in err) {
          return err;
        }

        return buildConnectError(
          requestId,
          err?.message,
          CONNECT_EVENT_ERROR_CODES.UNKNOWN_ERROR,
        );
      }
    },

    disconnect: async () => {
      requestId = 0;

      await callApi(
        'tonConnect_disconnect',
        buildDappRequest(url),
        { id: requestId.toString(), method: 'disconnect', params: [] },
      );
    },

    send: async <T extends RpcMethod>(request: AppRequest<T>) => {
      requestId++;

      const global = getGlobal();
      const isConnected = global.byAccountId[global.currentAccountId!].dapps?.some((dapp) => dapp.url === url);

      if (!isConnected) {
        return {
          error: {
            code: SEND_TRANSACTION_ERROR_CODES.UNKNOWN_APP_ERROR,
            message: 'Unknown app',
          },
          id: request.id.toString(),
        };
      }

      const dappRequest = buildDappRequest(url);

      try {
        switch (request.method) {
          case 'disconnect': {
            return (await callApi(
              'tonConnect_disconnect',
              dappRequest,
              request,
            ))!;
          }

          case 'sendTransaction': {
            const result = await callApi(
              'tonConnect_sendTransaction',
              dappRequest,
              request,
            );

            if (IS_DELEGATED_BOTTOM_SHEET) {
              void BottomSheet.applyScrollPatch();
            }

            return result!;
          }

          case 'signData': {
            return (await callApi(
              'tonConnect_signData',
              dappRequest,
              request,
            ))!;
          }

          default: {
            const anyRequest = request;

            return {
              id: String(anyRequest.id),
              error: {
                code: SEND_TRANSACTION_ERROR_CODES.BAD_REQUEST_ERROR,
                message: `Method "${anyRequest.method}" is not supported`,
              },
            };
          }
        }
      } catch (err: any) {
        logDebugError('useDAppBridge:send', err);

        return {
          id: String(request.id),
          error: {
            code: SEND_TRANSACTION_ERROR_CODES.UNKNOWN_ERROR,
            message: err?.message,
          },
        };
      }
    },
  };
}

function buildConnectError(
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

function verifyConnectRequest(request: ConnectRequest) {
  if (!(request && request.manifestUrl && request.items?.length)) {
    throw new Error('Wrong request data');
  }
}

function buildDappRequest(origin: string) {
  return {
    url: origin,
    isUrlEnsured: true,
    accountId: getGlobal().currentAccountId,
  };
}
