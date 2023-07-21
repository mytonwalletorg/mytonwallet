import TonWeb from 'tonweb';

import { logDebugError } from '../../../../util/logs';
import { pause } from '../../../../util/schedulers';

const ATTEMPTS = 5;
const ERROR_PAUSE = 200; // 200 ms

class CustomHttpProvider extends TonWeb.HttpProvider {
  send(method: string, params: any): Promise<Response> {
    return this.sendRequest(this.host, {
      id: 1, jsonrpc: '2.0', method, params,
    });
  }

  async sendRequest(apiUrl: string, request: any) {
    const method: string = request.method;
    let lastError: any;
    let lastStatusCode: number | undefined;

    const headers: AnyLiteral = {
      'Content-Type': 'application/json',
    };
    if (this.options.apiKey) {
      headers['X-API-Key'] = this.options.apiKey;
    }
    const body = JSON.stringify(request);

    for (let i = 1; i <= ATTEMPTS; i++) {
      try {
        const response = await fetch(apiUrl, {
          method: 'POST', headers, body,
        });
        lastStatusCode = response.status;
        const { error, result } = await response.json();
        if (error) {
          throw new Error(error);
        }
        return result;
      } catch (err: any) {
        lastError = err;

        const message: string = typeof err === 'string' ? err : err.message;
        if (isNotTemporaryError(method, message, lastStatusCode)) {
          throw err;
        }

        if (i < ATTEMPTS) {
          if (!isFrequentError(message)) {
            logDebugError('HttpProvider:sendRequest', 'retry', err);
          }
          await pause(ERROR_PAUSE * i);
        }
      }
    }

    throw lastError;
  }
}

function isNotTemporaryError(method: string, message: string, statusCode?: number) {
  return statusCode === 422 || (method === 'sendBoc' && message?.includes('exitcode='));
}

function isFrequentError(message: string) {
  return message.includes('LITE_SERVER_NOTREADY') || message.includes('LITE_SERVER_UNKNOWN');
}

export default CustomHttpProvider;
