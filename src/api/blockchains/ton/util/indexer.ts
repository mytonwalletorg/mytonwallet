import type { ApiNetwork } from '../../../types';
import type { ApiTransactionExtra } from '../types';

import {
  TON_TOKEN_SLUG,
  TONHTTPAPI_MAINNET_API_KEY,
  TONHTTPAPI_TESTNET_API_KEY,
  TONHTTPAPI_V3_MAINNET_API_KEY,
  TONHTTPAPI_V3_TESTNET_API_KEY,
} from '../../../../config';
import { fetchJson } from '../../../common/utils';
import { getEnvironment } from '../../../environment';
import { parseTxId, stringifyTxId } from './index';
import { toBase64Address } from './tonCore';

export async function fetchTransactions(
  network: ApiNetwork,
  address: string,
  limit: number,
  toTxId?: string,
  fromTxId?: string,
): Promise<ApiTransactionExtra[]> {
  const indexerUrl = network === 'testnet' ? TONHTTPAPI_V3_TESTNET_API_KEY : TONHTTPAPI_V3_MAINNET_API_KEY;
  const apiKey = network === 'testnet' ? TONHTTPAPI_TESTNET_API_KEY : TONHTTPAPI_MAINNET_API_KEY;

  const fromLt = fromTxId ? parseTxId(fromTxId).lt.toString() : undefined;
  const toLt = toTxId ? parseTxId(toTxId).lt.toString() : undefined;

  let { transactions: rawTransactions }: { transactions: any[] } = await fetchJson(`${indexerUrl}/transactions`, {
    account: address,
    limit,
    start_lt: fromLt,
    end_lt: toLt,
    sort: 'desc',
  }, {
    headers: {
      ...(apiKey && { 'X-Api-Key': apiKey }),
      ...getEnvironment().apiHeaders,
    },
  });

  if (!rawTransactions.length) {
    return [];
  }

  if (limit > 1) {
    if (fromLt && rawTransactions[rawTransactions.length - 1].lt === fromLt) {
      rawTransactions.pop();
    }

    if (toLt && rawTransactions[0]?.lt === toLt) {
      rawTransactions = rawTransactions.slice(1);
    }
  }

  return rawTransactions.map(parseRawTransaction).flat();
}

function parseRawTransaction(rawTx: any): ApiTransactionExtra[] {
  const {
    now,
    lt,
    hash,
    total_fees: fee,
  } = rawTx;

  const txId = stringifyTxId({ lt, hash });
  const timestamp = now as number * 1000;
  const isIncoming = !!rawTx.in_msg.source;
  const msgs: any[] = isIncoming ? [rawTx.in_msg] : rawTx.out_msgs;

  if (!msgs.length) return [];

  return msgs.map((msg, i) => {
    const { source, destination, value } = msg;
    const normalizedAddress = toBase64Address(isIncoming ? source : destination, true);
    return {
      txId: msgs.length > 1 ? `${txId}:${i + 1}` : txId,
      timestamp,
      isIncoming,
      fromAddress: toBase64Address(source),
      toAddress: toBase64Address(destination),
      amount: isIncoming ? BigInt(value) : -BigInt(value),
      slug: TON_TOKEN_SLUG,
      fee: BigInt(fee),
      extraData: {
        normalizedAddress,
        body: getRawBody(msg),
      },
    };
  });
}

function getRawBody(msg: any) {
  if (!msg.message_content) return undefined;
  return msg.message_content.body;
}
