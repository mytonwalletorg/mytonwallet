import type { JettonBalance } from 'tonapi-sdk-js';
import TonWeb from 'tonweb';

import type {
  ApiBaseToken, ApiNetwork, ApiToken, ApiTokenSimple,
} from '../../types';
import type { AnyPayload, ApiTransactionExtra, JettonMetadata } from './types';

import { parseAccountId } from '../../../util/account';
import { logDebugError } from '../../../util/logs';
import { buildTokenSlug } from './util';
import {
  fixBase64ImageData,
  fixIpfsUrl,
  getJettonMetadata,
  parseJettonWalletMsgBody,
} from './util/metadata';
import { fetchJettonBalances } from './util/tonapiio';
import {
  buildTokenTransferBody,
  getTonWeb,
  resolveTokenMinterAddress,
  resolveTokenWalletAddress,
  toBase64Address,
} from './util/tonweb';
import { fetchStoredAddress } from '../../common/accounts';
import {
  DEFAULT_DECIMALS,
  TOKEN_TRANSFER_TON_AMOUNT,
  TOKEN_TRANSFER_TON_FORWARD_AMOUNT,
} from './constants';

const { JettonWallet } = TonWeb.token.jetton;

export type JettonWalletType = InstanceType<typeof JettonWallet>;
export type TokenBalanceParsed = {
  slug: string;
  balance: string;
  token: ApiTokenSimple;
} | undefined;

const KNOWN_TOKENS: ApiBaseToken[] = [
  {
    slug: 'toncoin',
    name: 'Toncoin',
    symbol: 'TON',
    decimals: 9,
  },
];

const knownTokens = {} as Record<string, ApiToken>;
addKnownTokens(KNOWN_TOKENS);

export async function getAccountTokenBalances(accountId: string) {
  const { network } = parseAccountId(accountId);
  const address = await fetchStoredAddress(accountId);

  const balancesRaw: Array<JettonBalance> = await fetchJettonBalances(network, address);
  return balancesRaw.map(parseTokenBalance).filter(Boolean);
}

function parseTokenBalance(balanceRaw: JettonBalance): TokenBalanceParsed {
  if (!balanceRaw.jetton) {
    return undefined;
  }

  try {
    const { balance, jetton } = balanceRaw;
    const minterAddress = toBase64Address(jetton.address);
    const token = buildTokenByMetadata(minterAddress, jetton);

    return { slug: token.slug, balance, token };
  } catch (err) {
    logDebugError('parseTokenBalance', err);
    return undefined;
  }
}

export function parseTokenTransaction(
  tx: ApiTransactionExtra,
  slug: string,
  walletAddress: string,
): ApiTransactionExtra | undefined {
  const { extraData } = tx;
  if (!extraData?.body) {
    return undefined;
  }

  const parsedData = parseJettonWalletMsgBody(extraData.body);
  if (!parsedData) {
    return undefined;
  }

  const {
    operation, jettonAmount, address, comment, encryptedComment,
  } = parsedData;
  const isIncoming = operation === 'InternalTransfer';

  return {
    ...tx,
    slug,
    fromAddress: isIncoming ? (address ?? tx.fromAddress) : walletAddress,
    toAddress: isIncoming ? walletAddress : address!,
    amount: isIncoming ? jettonAmount.toString() : `-${jettonAmount}`,
    comment,
    encryptedComment,
    isIncoming,
  };
}

export async function buildTokenTransfer(
  network: ApiNetwork,
  slug: string,
  fromAddress: string,
  toAddress: string,
  amount: string,
  payload?: AnyPayload,
) {
  const minterAddress = resolveTokenBySlug(slug).minterAddress!;
  const tokenWalletAddress = await resolveTokenWalletAddress(network, fromAddress, minterAddress);
  const realMinterAddress = await resolveTokenMinterAddress(network, tokenWalletAddress);
  if (minterAddress !== realMinterAddress) {
    throw new Error('Invalid contract');
  }

  const tokenWallet = getTokenWallet(network, tokenWalletAddress);

  payload = buildTokenTransferBody({
    tokenAmount: amount,
    toAddress,
    forwardAmount: TOKEN_TRANSFER_TON_FORWARD_AMOUNT.toString(),
    forwardPayload: payload,
    responseAddress: fromAddress,
  });

  return {
    tokenWallet,
    amount: TOKEN_TRANSFER_TON_AMOUNT.toString(),
    toAddress: tokenWalletAddress,
    payload,
  };
}

export function resolveTokenBySlug(slug: string) {
  return knownTokens[slug]!;
}

export function getTokenWallet(network: ApiNetwork, tokenAddress: string) {
  return new JettonWallet(getTonWeb(network).provider, { address: tokenAddress });
}

export async function getTokenWalletBalance(tokenWallet: JettonWalletType) {
  return (await tokenWallet.getData()).balance.toString();
}

export function getKnownTokens() {
  return knownTokens;
}

export function addKnownTokens(tokens: ApiBaseToken[]) {
  for (const token of tokens) {
    if (token.slug in knownTokens) continue;

    knownTokens[token.slug] = {
      ...token,
      quote: {
        price: 0,
        percentChange1h: 0,
        percentChange24h: 0,
        percentChange7d: 0,
        percentChange30d: 0,
      },
    };
  }
}

export async function importToken(network: ApiNetwork, address: string) {
  const metadata = await getJettonMetadata(network, address);

  return buildTokenByMetadata(address, metadata);
}

function buildTokenByMetadata(address: string, metadata: JettonMetadata): ApiBaseToken {
  const {
    name,
    symbol,
    image,
    image_data: imageData,
    decimals,
  } = metadata;

  return {
    slug: buildTokenSlug(address),
    name,
    symbol,
    decimals: decimals === undefined ? DEFAULT_DECIMALS : Number(decimals),
    minterAddress: address,
    image: (image && fixIpfsUrl(image)) || (imageData && fixBase64ImageData(imageData)) || undefined,
  };
}
