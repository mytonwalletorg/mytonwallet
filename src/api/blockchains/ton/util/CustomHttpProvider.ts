import TonWeb from 'tonweb';
import type { HttpProviderOptions } from 'tonweb/dist/types/providers/http-provider';

import { pause } from '../../../../util/schedulers';
import { ApiServerError } from '../../../errors';

type Options = HttpProviderOptions & {
  headers?: AnyLiteral;
};

const ATTEMPTS = 5;
const ERROR_PAUSE = 200; // 200 ms

class CustomHttpProvider extends TonWeb.HttpProvider {
  options: Options;

  constructor(host: string, options?: Options) {
    super(host, options);
    this.options = options ?? {};
  }

  send(method: string, params: any): Promise<Response> {
    return this.sendRequest(this.host, {
      id: 1, jsonrpc: '2.0', method, params,
    });
  }

  async sendRequest(apiUrl: string, request: any) {
    const method: string = request.method;

    const headers: AnyLiteral = {
      ...this.options.headers,
      'Content-Type': 'application/json',
    };
    if (this.options.apiKey) {
      headers['X-API-Key'] = this.options.apiKey;
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

export default CustomHttpProvider;
