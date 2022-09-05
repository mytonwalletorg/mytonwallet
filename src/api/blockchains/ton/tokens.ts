import TonWeb from 'tonweb';
import {
  AccountEvent,
  Action,
  ActionStatusEnum,
  ActionTypeEnum,
  Jetton,
  JettonBalance,
} from 'tonapi-sdk-js';

import { Storage } from '../../storages/types';
import { DEBUG } from '../../../config';
import { fetchAddress } from './address';
import { getTonWeb, toBase64Address } from './util/tonweb';
import {
  TOKEN_TRANSFER_TON_AMOUNT,
  TOKEN_TRANSFER_TON_FORWARD_AMOUNT,
} from './constants';
import { ApiToken } from '../../types';
import { ApiTransactionWithLt } from './types';
import { fetchJettonBalances } from './util/tonapiio';
import { fixBase64ImageData, fixIpfsUrl } from './util/metadata';

const { Address } = TonWeb.utils;
const { JettonWallet, JettonMinter } = TonWeb.token.jetton;
export type JettonWalletType = InstanceType<typeof JettonWallet>;

interface ExtendedJetton extends Jetton {
  image_data?: string;
}

const knownTokens: Record<string, ApiToken> = {
  toncoin: {
    slug: 'toncoin',
    name: 'Toncoin',
    symbol: 'TON',
    quote: {
      price: 0,
      percentChange1h: 0,
      percentChange24h: 0,
      percentChange7d: 0,
      percentChange30d: 0,
    },
  },
};

const DATA_TEXT_PREFIX = [0, 0, 0, 0];

export async function getAccountTokenBalances(storage: Storage, accountId: string) {
  const address = await fetchAddress(storage, accountId);

  const balancesRaw: Array<JettonBalance> = await fetchJettonBalances(address);
  return Object.fromEntries(balancesRaw.map(buildTokenBalance).filter(Boolean));
}

function buildTokenBalance(balanceRaw: JettonBalance): [string, string] | undefined {
  if (!balanceRaw.metadata) {
    return undefined;
  }

  try {
    const {
      name,
      symbol,
      address: rawMinterAddress,
      image,
      image_data: imageData,
    } = balanceRaw.metadata as ExtendedJetton;
    const minterAddress = toBase64Address(rawMinterAddress);
    const slug = buildTokenSlug(symbol);

    if (!(slug in knownTokens)) {
      knownTokens[slug] = {
        slug,
        name,
        symbol,
        minterAddress,
        image: (image && fixIpfsUrl(image)) || (imageData && fixBase64ImageData(imageData)),
        quote: {
          price: 0,
          percentChange1h: 0,
          percentChange24h: 0,
          percentChange7d: 0,
          percentChange30d: 0,
        },
      };
    }

    return [slug, balanceRaw.balance];
  } catch (err) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.warn('[buildTokenBalance]', err);
    }
    return undefined;
  }
}

export async function buildTokenTransfer(
  slug: string,
  fromAddress: string,
  toAddress: string,
  amount: string,
  data?: string,
) {
  const tokenAddress = await resolveTokenAddress(fromAddress, resolveTokenBySlug(slug).minterAddress!);
  const tokenWallet = getTokenWallet(tokenAddress);

  const forwardPayload = data && DATA_TEXT_PREFIX.concat(
    Array.from(new TextEncoder().encode(data)),
  );
  const payload = await tokenWallet.createTransferBody({
    tokenAmount: new TonWeb.utils.BN(amount), // TODO Waiting for a typo fix in tonweb
    jettonAmount: new TonWeb.utils.BN(amount), // tokenAmount <-> jettonAmount
    toAddress: new Address(toAddress),
    forwardAmount: TonWeb.utils.toNano(TOKEN_TRANSFER_TON_FORWARD_AMOUNT),
    forwardPayload,
    responseAddress: new Address(fromAddress),
  } as any);

  return {
    tokenWallet,
    amount: TonWeb.utils.toNano(TOKEN_TRANSFER_TON_AMOUNT).toString(),
    toAddress: tokenAddress,
    payload,
  };
}

export async function resolveTokenAddress(address: string, minterAddress: string) {
  const minter = new JettonMinter(getTonWeb().provider, { address: minterAddress } as any);
  return (await minter.getJettonWalletAddress(new Address(address)))
    .toString(true, true, true);
}

export function resolveTokenBySlug(slug: string) {
  return knownTokens[slug]!;
}

export function getTokenWallet(tokenAddress: string) {
  return new JettonWallet(getTonWeb().provider, { address: tokenAddress });
}

export async function getTokenWalletBalance(tokenWallet: JettonWalletType) {
  return (await tokenWallet.getData()).balance;
}

function buildTokenSlug(symbol: string) {
  return `ton-${symbol}`.toLowerCase();
}

export function buildTokenTransaction(event: AccountEvent, action: Action): ApiTransactionWithLt | undefined {
  if (action.type !== ActionTypeEnum.JettonTransfer || action.status !== ActionStatusEnum.Ok) {
    return undefined;
  }

  try {
    const {
      amount,
      comment,
      sender,
      recipient,
      jetton,
    } = action.jettonTransfer!;
    const minterAddress = toBase64Address(jetton.address);
    const jettonInfo = Object.values(knownTokens).find((x) => x.minterAddress === minterAddress);
    const fromAddress = toBase64Address(sender!.address);
    const isIncoming = fromAddress !== toBase64Address(event.account.address);
    return {
      txId: `${event.lt}:NOHASH`,
      timestamp: event.timestamp * 1000,
      fromAddress,
      toAddress: toBase64Address(recipient!.address),
      amount: isIncoming || amount === '0' ? amount : `-${amount}`,
      comment,
      fee: event.fee.total.toString(),
      slug: jettonInfo?.slug,
      isIncoming,
      lt: event.lt,
    };
  } catch (err) {
    return undefined;
  }
}

export function getKnownTokens() {
  return knownTokens;
}
