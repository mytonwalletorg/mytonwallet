import type {
  AppRequest,
  ConnectEvent,
  ConnectRequest,
  DeviceInfo,
  DisconnectEvent,
  RpcRequests,
} from '@tonconnect/protocol';
import nacl, { randomBytes } from 'tweetnacl';

import type { ApiDappRequest, ApiSseOptions } from '../types';

import { parseAccountId } from '../../util/account';
import { extractKey } from '../../util/iteratees';
import { logDebug, logDebugError } from '../../util/logs';
import safeExec from '../../util/safeExec';
import { getCurrentNetwork, waitLogin } from '../common/accounts';
import { bytesToHex, handleFetchErrors } from '../common/utils';
import {
  getDappsState,
  getSseLastEventId,
  setSseLastEventId,
} from '../methods/dapps';
import * as tonConnect from './index';

type SseDapp = {
  accountId: string;
  origin: string;
} & ApiSseOptions;

type ReturnStrategy = 'back' | 'none' | string;

const BRIDGE_URL = 'https://tonconnectbridge.mytonwallet.org/bridge';
const TTL_SEC = 300;
const NONCE_SIZE = 24;

let sseEventSource: EventSource | undefined;
let sseDapps: SseDapp[] = [];

export async function startSseConnection(url: string, deviceInfo: DeviceInfo): Promise<ReturnStrategy | undefined> {
  const params = new URL(url).searchParams;

  const ret = params.get('ret') as ReturnStrategy | null;

  if (!ret || !params.get('r')) {
    return ret ?? undefined;
  }

  const version = Number(params.get('v') as string);
  const appClientId = params.get('id') as string;
  const connectRequest = JSON.parse(params.get('r') as string) as ConnectRequest;
  const { origin } = await tonConnect.fetchDappMetadata(connectRequest.manifestUrl);

  logDebug('SSE Start connection:', {
    version, appClientId, connectRequest, ret, origin,
  });

  const { secretKey: secretKeyArray, publicKey: publicKeyArray } = nacl.box.keyPair();
  const secretKey = bytesToHex(secretKeyArray);
  const clientId = bytesToHex(publicKeyArray);

  const lastOutputId = 0;
  const request: ApiDappRequest = {
    origin,
    sseOptions: {
      clientId,
      appClientId,
      secretKey,
      lastOutputId,
    },
  };

  await waitLogin();

  const result = await tonConnect.connect(request, connectRequest, lastOutputId) as ConnectEvent;
  if (result.event === 'connect') {
    result.payload.device = deviceInfo;
  }

  await sendMessage(result, secretKey, clientId, appClientId);

  if (result.event !== 'connect_error') {
    await resetupSseConnection();
  }

  return ret;
}

export async function resetupSseConnection() {
  closeEventSource();

  const [lastEventId, dappsState, network] = await Promise.all([
    getSseLastEventId(),
    getDappsState(),
    getCurrentNetwork(),
  ]);

  if (!dappsState || !network) {
    return;
  }

  sseDapps = Object.entries(dappsState).reduce((result, [accountId, dapps]) => {
    if (parseAccountId(accountId).network === network) {
      for (const dapp of Object.values(dapps)) {
        result.push({ ...dapp.sse!, accountId, origin: dapp.origin });
      }
    }
    return result;
  }, [] as SseDapp[]);

  const clientIds = extractKey(sseDapps, 'clientId');
  if (!clientIds.length) {
    return;
  }

  if (sseEventSource) {
    safeExec(() => {
      sseEventSource!.close();
    });
    sseEventSource = undefined;
  }

  sseEventSource = openEventSource(clientIds, lastEventId);

  sseEventSource.onopen = () => {
    logDebug('EventSource opened');
  };

  sseEventSource.onerror = (e) => {
    logDebugError('EventSource', e.type);
  };

  sseEventSource.onmessage = async (event) => {
    const { from, message: encryptedMessage } = JSON.parse(event.data);

    const sseDapp = sseDapps.find(({ appClientId }) => appClientId === from);
    if (!sseDapp) {
      logDebug(`Dapp with clientId ${from} not found`);
      return;
    }

    const {
      accountId, clientId, appClientId, secretKey, origin,
    } = sseDapp;
    const message = decryptMessage(encryptedMessage, appClientId, secretKey) as AppRequest<keyof RpcRequests>;

    logDebug('SSE Event:', message);

    await setSseLastEventId(event.lastEventId);

    // @ts-ignore
    const result = await tonConnect[message.method]({ origin, accountId }, message);

    await sendMessage(result, secretKey, clientId, appClientId);
  };
}

export async function sendSseDisconnect(accountId: string, origin: string) {
  const sseDapp = sseDapps.find((dapp) => dapp.origin === origin && dapp.accountId === accountId);
  if (!sseDapp) return;

  const { secretKey, clientId, appClientId } = sseDapp;
  const lastOutputId = sseDapp.lastOutputId + 1;

  const response: DisconnectEvent = {
    event: 'disconnect',
    id: lastOutputId,
    payload: {},
  };

  await sendMessage(response, secretKey, clientId, appClientId);
}

function sendMessage(
  message: AnyLiteral, secretKey: string, clientId: string, toId: string, topic?: 'signTransaction' | 'signData',
) {
  const buffer = Buffer.from(JSON.stringify(message));
  const encryptedMessage = encryptMessage(buffer, toId, secretKey);
  return sendRawMessage(encryptedMessage, clientId, toId, topic);
}

async function sendRawMessage(body: string, clientId: string, toId: string, topic?: 'signTransaction' | 'signData') {
  const url = new URL(`${BRIDGE_URL}/message`);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('to', toId);
  url.searchParams.set('ttl', TTL_SEC.toString());
  if (topic) {
    url.searchParams.set('topic', topic);
  }

  const response = await fetch(url, { method: 'POST', body });
  handleFetchErrors(response);
}

function closeEventSource() {
  if (!sseEventSource) return;

  sseEventSource.close();
  sseEventSource = undefined;
}

function openEventSource(clientIds: string[], lastEventId?: string) {
  const url = new URL(`${BRIDGE_URL}/events`);
  url.searchParams.set('client_id', clientIds.join(','));
  if (lastEventId) {
    url.searchParams.set('last_event_id', lastEventId);
  }
  return new EventSource(url);
}

function encryptMessage(message: Uint8Array, publicKey: string, secretKey: string) {
  const nonce = randomBytes(NONCE_SIZE);
  const encrypted = nacl.box(
    message, nonce, Buffer.from(publicKey, 'hex'), Buffer.from(secretKey, 'hex'),
  );
  return Buffer.concat([nonce, encrypted]).toString('base64');
}

function decryptMessage(message: string, publicKey: string, secretKey: string) {
  const fullBuffer = Buffer.from(message, 'base64');
  const nonce = fullBuffer.subarray(0, NONCE_SIZE);
  const encrypted = fullBuffer.subarray(NONCE_SIZE);
  const decrypted = nacl.box.open(
    encrypted,
    nonce,
    Buffer.from(publicKey, 'hex'),
    Buffer.from(secretKey, 'hex'),
  );
  const jsonText = new TextDecoder('utf-8').decode(decrypted!);
  return JSON.parse(jsonText);
}
