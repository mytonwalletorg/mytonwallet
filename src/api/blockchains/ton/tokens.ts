import TonWeb from 'tonweb';
import {
  AccountEvent,
  Action,
  ActionStatusEnum,
  ActionTypeEnum,
} from 'tonapi-sdk-js';

import { Storage } from '../../storages/types';
import { BRILLIANT_API_BASE_URL } from '../../../config';
import { handleFetchErrors } from '../../common/utils';
import { fetchAddress } from './address';
import { getTonWeb, toBase64Address } from './util/tonweb';
import {
  TOKEN_TRANSFER_TON_AMOUNT,
  TOKEN_TRANSFER_TON_FORWARD_AMOUNT,
} from './constants';
import { ApiTransaction } from '../../types';

const { Address } = TonWeb.utils;
const { JettonWallet, JettonMinter } = TonWeb.token.jetton;
export type JettonWalletType = InstanceType<typeof JettonWallet>;

interface TokenInfo {
  slug: string;
  symbol: string;
  minterAddress: string;
}

interface TokenBalanceInfo extends TokenInfo {
  balance: string;
  jettonAddress: string;
}

const knownTokensCache: Record<string, TokenInfo> = {};

export async function getAccountTokensBalances(storage: Storage, accountId: string) {
  const address = await fetchAddress(storage, accountId);
  const url = `${BRILLIANT_API_BASE_URL}/jetton-balances?`;
  const response = await fetch(url + new URLSearchParams({ account: address }));
  handleFetchErrors(response);

  const balances = (await response.json()).balances as TokenBalanceInfo[];
  updateKnownTokensCache(balances);
  return Object.fromEntries(balances.map((balance) => [balance.slug, balance.balance]));
}

function updateKnownTokensCache(tokens: TokenInfo[]) {
  tokens.filter(({ slug }) => !(slug in knownTokensCache))
    .forEach(({ slug, symbol, minterAddress }) => {
      knownTokensCache[slug] = { slug, symbol, minterAddress };
    });
}

export async function buildTokenTransfer(
  slug: string,
  fromAddress: string,
  toAddress: string,
  amount: string,
  data?: string,
) {
  const tokenAddress = await resolveTokenAddress(fromAddress, resolveTokenBySlug(slug).minterAddress);
  const tokenWallet = getTokenWallet(tokenAddress);

  const payload = await tokenWallet.createTransferBody({
    tokenAmount: new TonWeb.utils.BN(amount), // TODO Waiting for a typo fix in tonweb
    jettonAmount: new TonWeb.utils.BN(amount), // tokenAmount <-> jettonAmount
    toAddress: new Address(toAddress),
    forwardAmount: TonWeb.utils.toNano(TOKEN_TRANSFER_TON_FORWARD_AMOUNT),
    forwardPayload: data && new TextEncoder().encode(data),
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
  return knownTokensCache[slug]!;
}

export function getTokenWallet(tokenAddress: string) {
  return new JettonWallet(getTonWeb().provider, { address: tokenAddress });
}

export async function getTokenWalletBalance(tokenWallet: JettonWalletType) {
  return (await tokenWallet.getData()).balance;
}

export function buildTokenTransaction(event: AccountEvent, action: Action) {
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
    const jettonInfo = Object.values(knownTokensCache).find((x) => x.minterAddress === minterAddress);
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
    } as ApiTransaction;
  } catch (err) {
    return undefined;
  }
}
