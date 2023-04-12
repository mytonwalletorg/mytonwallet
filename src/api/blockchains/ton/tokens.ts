import TonWeb from 'tonweb';
import { Jetton, JettonBalance } from 'tonapi-sdk-js';

import { Storage } from '../../storages/types';
import { DEBUG } from '../../../config';
import { fetchAddress } from './address';
import { buildTokenTransferBody, getTonWeb, toBase64Address } from './util/tonweb';
import {
  TOKEN_TRANSFER_TON_AMOUNT,
  TOKEN_TRANSFER_TON_FORWARD_AMOUNT,
} from './constants';
import {
  ApiNetwork, ApiToken, ApiBaseToken, ApiTokenSimple,
} from '../../types';
import { fetchJettonBalances } from './util/tonapiio';
import { fixBase64ImageData, fixIpfsUrl, parseJettonWalletMsgBody } from './util/metadata';
import { parseAccountId } from '../../../util/account';
import { ApiTransactionExtra } from './types';
import withCache from '../../../util/withCache';

const { Address, toNano } = TonWeb.utils;
const { JettonWallet, JettonMinter } = TonWeb.token.jetton;

export type JettonWalletType = InstanceType<typeof JettonWallet>;
export type TokenBalanceParsed = {
  slug: string;
  balance: string;
  token: ApiTokenSimple;
} | undefined;

interface ExtendedJetton extends Jetton {
  image_data?: string;
}

const KNOWN_TOKENS: ApiBaseToken[] = [
  {
    slug: 'toncoin',
    name: 'Toncoin',
    symbol: 'TON',
    decimals: 9,
  },
];

const knownTokens = KNOWN_TOKENS.reduce((tokens, token) => {
  tokens[token.slug] = {
    ...token,
    quote: {
      price: 0,
      percentChange1h: 0,
      percentChange24h: 0,
      percentChange7d: 0,
      percentChange30d: 0,
    },
  };
  return tokens;
}, {} as Record<string, ApiToken>);

export const resolveTokenWalletAddress = withCache(async (
  network: ApiNetwork,
  address: string,
  minterAddress: string,
) => {
  const minter = new JettonMinter(getTonWeb(network).provider, { address: minterAddress } as any);
  return (await minter.getJettonWalletAddress(new Address(address))).toString(true, true, true);
});

export const resolveTokenMinterAddress = withCache(async (network: ApiNetwork, tokenWalletAddress: string) => {
  const tokenWallet = new JettonWallet(getTonWeb(network).provider, { address: tokenWalletAddress } as any);
  return (await tokenWallet.getData()).jettonMinterAddress.toString(true, true, true);
});

export async function getAccountTokenBalances(storage: Storage, accountId: string) {
  const { network } = parseAccountId(accountId);
  const address = await fetchAddress(storage, accountId);

  const balancesRaw: Array<JettonBalance> = await fetchJettonBalances(network, address);
  return balancesRaw.map(parseTokenBalance).filter(Boolean);
}

function parseTokenBalance(balanceRaw: JettonBalance): TokenBalanceParsed {
  if (!balanceRaw.metadata) {
    return undefined;
  }

  try {
    const { balance, jettonAddress, metadata } = balanceRaw;
    const {
      name,
      symbol,
      image,
      image_data: imageData,
      decimals,
    } = metadata as ExtendedJetton;
    const minterAddress = toBase64Address(jettonAddress);

    const slug = buildTokenSlug(minterAddress);
    const token: ApiTokenSimple = {
      slug,
      name,
      symbol,
      decimals,
      minterAddress,
      image: (image && fixIpfsUrl(image)) || (imageData && fixBase64ImageData(imageData)),
    };

    return { slug, balance, token };
  } catch (err) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.warn('[buildTokenBalance]', err);
    }
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
    operation, jettonAmount, address, forwardComment,
  } = parsedData;
  const isIncoming = operation === 'internalTransfer';

  return {
    ...tx,
    slug,
    fromAddress: isIncoming ? address : walletAddress,
    toAddress: isIncoming ? walletAddress : address,
    amount: isIncoming ? jettonAmount.toString() : `-${jettonAmount}`,
    comment: forwardComment,
    isIncoming,
  };
}

export async function buildTokenTransfer(
  network: ApiNetwork,
  slug: string,
  fromAddress: string,
  toAddress: string,
  amount: string,
  data?: string,
) {
  const minterAddress = resolveTokenBySlug(slug).minterAddress!;
  const tokenWalletAddress = await resolveTokenWalletAddress(network, fromAddress, minterAddress);
  const realMinterAddress = await resolveTokenMinterAddress(network, tokenWalletAddress);
  if (minterAddress !== realMinterAddress) {
    throw new Error('Invalid contract');
  }

  const tokenWallet = getTokenWallet(network, tokenWalletAddress);
  const forwardComment = new TonWeb.boc.Cell();
  if (data) {
    forwardComment.bits.writeUint(0, 32);
    forwardComment.bits.writeBytes(Buffer.from(data));
  }

  const payload = buildTokenTransferBody({
    tokenAmount: amount,
    toAddress,
    forwardAmount: toNano(TOKEN_TRANSFER_TON_FORWARD_AMOUNT).toString(),
    forwardPayload: forwardComment,
    responseAddress: fromAddress,
  });

  return {
    tokenWallet,
    amount: toNano(TOKEN_TRANSFER_TON_AMOUNT).toString(),
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

export function buildTokenSlug(minterAddress: string) {
  const addressPart = minterAddress.replace(/[^a-z\d]/gi, '').slice(0, 10);
  return `ton-${addressPart}`.toLowerCase();
}

export function getKnownTokens() {
  return knownTokens;
}
