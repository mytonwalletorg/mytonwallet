import axios from 'axios';
import type { TonClientParameters } from '@ton/ton/dist/client/TonClient';
import { TonClient as TonCoreClient } from '@ton/ton/dist/client/TonClient';

import type { GetAddressInfoResponse } from '../types';

import axiosRetry from '../../../../lib/axios-retry';
import { pause } from '../../../../util/schedulers';
import { ApiServerError } from '../../../errors';

const ATTEMPTS = 5;
const ERROR_PAUSE = 200; // 200 ms

axiosRetry(axios, {
  retries: ATTEMPTS,
  retryDelay: (retryCount) => {
    return retryCount * ERROR_PAUSE;
  },
});

type Parameters = TonClientParameters & {
  headers?: AnyLiteral;
};

export class TonClient extends TonCoreClient {
  private initParameters: Parameters;

  constructor(parameters: Parameters) {
    super(parameters);
    this.initParameters = parameters;
  }

  getWalletInfo(address: string) {
    return this.callRpc('getWalletInformation', { address });
  }

  getAddressInfo(address: string): Promise<GetAddressInfoResponse> {
    return this.callRpc('getAddressInformation', { address });
  }

  callRpc(method: string, params: any): Promise<any> {
    return this.sendRequest(this.parameters.endpoint, {
      id: 1, jsonrpc: '2.0', method, params,
    });
  }

  async sendRequest(apiUrl: string, request: any) {
    const method: string = request.method;

    const headers: AnyLiteral = {
      ...this.initParameters.headers,
      'Content-Type': 'application/json',
    };
    if (this.parameters.apiKey) {
      headers['X-API-Key'] = this.parameters.apiKey;
    }
    const body = JSON.stringify(request);

    let message = 'Unknown error.';
    let statusCode: number | undefined;

    for (let i = 1; i <= ATTEMPTS; i++) {
      try {
        const response = await fetch(apiUrl, {
          method: 'POST', headers, body,
        });
        statusCode = response.status;

        if (statusCode >= 400) {
          if (response.headers.get('content-type') !== 'application/json') {
            throw new Error(`HTTP Error ${statusCode}`);
          }
          const { error } = await response.json();
          throw new Error(error);
        }

        const { result } = await response.json();
        return result;
      } catch (err: any) {
        message = typeof err === 'string' ? err : err.message ?? message;

        if (isNotTemporaryError(method, message, statusCode)) {
          throw new ApiServerError(message);
        }

        if (i < ATTEMPTS) {
          await pause(ERROR_PAUSE * i);
        }
      }
    }

    throw new ApiServerError(message);
  }
}

function isNotTemporaryError(method: string, message: string, statusCode?: number) {
  return statusCode === 422 || (method === 'sendBoc' && message?.includes('exitcode='));
}
