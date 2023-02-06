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
import { buildTokenTransferBody, getTonWeb, toBase64Address } from './util/tonweb';
import {
  TOKEN_TRANSFER_TON_AMOUNT,
  TOKEN_TRANSFER_TON_FORWARD_AMOUNT,
} from './constants';
import {
  ApiNetwork, ApiToken, ApiBaseToken, ApiTokenSimple,
} from '../../types';
import { ApiTransactionWithLt } from './types';
import { fetchJettonBalances } from './util/tonapiio';
import { fixBase64ImageData, fixIpfsUrl } from './util/metadata';
import { parseAccountId } from '../../../util/account';

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
    id: 11419,
  },
  {
    slug: 'ton-eqc1yom8rb',
    name: 'Orbit Bridge Ton USD Tether',
    symbol: 'oUSDT',
    decimals: 6,
    minterAddress: 'EQC_1YoM8RBixN95lz7odcF3Vrkc_N8Ne7gQi7Abtlet_Efi',
    image: 'https://raw.githubusercontent.com/orbit-chain/bridge-token-image/main/ton/usdt.png',
    id: 825,
  },
  {
    slug: 'ton-eqavdfwfg0',
    name: 'Tegro',
    symbol: 'TGR',
    decimals: 9,
    minterAddress: 'EQAvDfWFG0oYX19jwNDNBBL1rKNT9XfaGP9HyTb5nb2Eml6y',
    image: 'https://tegro.io/tgr.png',
    id: 21133,
  },
  {
    slug: 'ton-eqcclaw537',
    name: 'Ambra',
    symbol: 'AMBR',
    decimals: 9,
    minterAddress: 'EQCcLAW537KnRg_aSPrnQJoyYjOZkzqYp6FVmRUvN1crSazV',
    image: fixIpfsUrl('ipfs://bafybeicsvozntp5iatwad32qgvisjxshop62erwohaqnajgsmkl77b6uh4'),
    id: 23154,
  },
  {
    slug: 'ton-eqbajmyi5w',
    name: 'TonexCoin',
    symbol: 'TNX',
    decimals: 9,
    minterAddress: 'EQB-ajMyi5-WKIgOHnbOGApfckUGbl6tDk3Qt8PKmb-xLAvp',
    image: fixIpfsUrl('ipfs://bafybeibxnqgi23lnegtngobej3rfka5ipntib4m3olotdfzlofgbvfrkr4'),
    id: 23155,
  },
  {
    slug: 'ton-eqblqsm144',
    name: 'Scaleton',
    symbol: 'SCALE',
    decimals: 9,
    minterAddress: 'EQBlqsm144Dq6SjbPI4jjZvA1hqTIP3CvHovbIfW_t-SCALE',
    image: fixIpfsUrl('ipfs://QmSMiXsZYMefwrTQ3P6HnDQaCpecS4EWLpgKK5EX1G8iA8'),
    id: 23156,
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

export async function buildTokenTransfer(
  network: ApiNetwork,
  slug: string,
  fromAddress: string,
  toAddress: string,
  amount: string,
  data?: string,
) {
  const tokenAddress = await resolveTokenAddress(network, fromAddress, resolveTokenBySlug(slug).minterAddress!);
  const tokenWallet = getTokenWallet(network, tokenAddress);

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
    toAddress: tokenAddress,
    payload,
  };
}

export async function resolveTokenAddress(network: ApiNetwork, address: string, minterAddress: string) {
  const minter = new JettonMinter(getTonWeb(network).provider, { address: minterAddress } as any);
  return (await minter.getJettonWalletAddress(new Address(address)))
    .toString(true, true, true);
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

function buildTokenSlug(minterAddress: string) {
  const addressPart = minterAddress.replace(/[^a-z\d]/gi, '').slice(0, 10);
  return `ton-${addressPart}`.toLowerCase();
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
