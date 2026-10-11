import type { ApiChain, ApiDerivationSpec, ApiNetwork, ApiToken, ApiTokenWithPrice, EVMChain } from '../api/types';

import {
  BNB,
  DEBUG,
  ION_BNB_MAINNET,
  TONCOIN,
} from '../config';
import { EVM_DERIVATION_PATHS } from '../api/chains/evm/constants';
import { TON_BIP39_PATH } from '../api/chains/ton/derivationConstants';
import formatTonTransferUrl from './ton/formatTransferUrl';
import { buildCollectionByKey } from './iteratees';
import withCache from './withCache';

// The EVM family is represented by BNB: it is the only EVM chain here, so it is also its own hub.
const EVM_CHAIN_STANDARD: ApiChain = 'bnb';

export type ExplorerLink = {
  url: string;
  param: string;
} | string;

export interface BaseExplorerConfig {
  id: string;
  name: string;
  baseUrl: Record<ApiNetwork, ExplorerLink>;
}
export interface ExplorerConfig extends BaseExplorerConfig {
  /** Use `{base}` as the base URL placeholder and `{address}` as the wallet address placeholder */
  address: string;
  /** Use `{base}` as the base URL placeholder and `{address}` as the token address placeholder */
  token: string;
  /** Use `{base}` as the base URL placeholder and `{hash}` as the transaction hash placeholder */
  transaction: string;
  /** Use `{base}` as the base URL placeholder and `{address}` as the NFT address placeholder */
  nft?: string;
  /** Use `{base}` as the base URL placeholder and `{address}` as the NFT collection address placeholder */
  nftCollection?: string;
  doConvertHashFromBase64: boolean;
}

export interface MarketplaceConfig extends BaseExplorerConfig {
  nft: string;
  /** Use `{base}` as the base URL placeholder and `{address}` as the NFT collection address placeholder */
  nftCollection?: string;
}

/**
 * Describes the chain features that distinguish it from other chains in the multichain-polymorphic parts of the code.
 */
export interface ChainConfig {
  /** The blockchain title to show in the UI */
  title: string;
  /**
   * The chain that stands for the whole family this chain belongs to: the aggregated cross-chain
   * requests (balances, activities) are addressed to it, and the other chains of the family read
   * their share out of its answer. A chain that is a family of its own leaves this unset.
   */
  chainStandard?: ApiChain;
  /** Whether the chain supports domain names that resolve to regular addresses */
  isDnsSupported: boolean;
  /** Whether the chain supports sending asset transfers with a comment */
  isTransferPayloadSupported: boolean;
  /** Whether the chain supports comment encrypting */
  isEncryptedCommentSupported: boolean;
  /** Whether the chain supports sending the full balance of the native token (the fee is taken from the sent amount) */
  canTransferFullNativeBalance: boolean;
  /** Whether Ledger support is implemented for this chain */
  isLedgerSupported: boolean;
  /**
   * The name of the Ledger app the user has to open, when it differs from the chain title.
   * ION is a TON fork and signs through Ledger's TON app, so telling the user to open an
   * "ION App" would send them looking for one that does not exist.
   */
  ledgerAppName?: string;
  /** Whether the chain supports multiWallet (e.g. Solana derivations or TON versions) */
  isSubwalletsSupported: boolean;
  /** The default derivation path for the chain */
  defaultDerivationPath?: string;
  /** Regular expression for wallet and contract addresses in the chain */
  addressRegex: RegExp;
  /** The same regular expression but matching any prefix of a valid address */
  addressPrefixRegex: RegExp;
  /** The native token of the chain, i.e. the token that pays the fees */
  nativeToken: ApiToken;
  /** Whether our own backend socket (src/api/common/backendSocket.ts) supports this chain */
  doesBackendSocketSupport: boolean;
  /** Whether the SDK allows to import tokens by address */
  canImportTokens: boolean;
  /** If `true`, the Send form UI will show a scam warning if the wallet has tokens but not enough gas to sent them */
  shouldShowScamWarningIfNotEnoughGas: boolean;
  /** Whether our own backend supports push notifications for addresses in this chain */
  doesSupportPushNotifications: boolean;
  /** A random but valid address for checking transfer fees */
  feeCheckAddress: string;
  /** The token slugs of this chain added to new accounts by default. */
  defaultEnabledSlugs: Record<ApiNetwork, string[]>;
  /**
   * The only non-native tokens of this chain the wallet keeps; unset means it keeps whatever the
   * balance provider reports. Enforced where EVM balances are ingested (`chains/evm/wallet.ts`),
   * so an unlisted token never reaches the balances, the token list or the total.
   */
  keptTokenSlugs?: string[];
  /**
   * The tokens to fill the token cache until it's loaded from the backend.
   * Should include the tokens from the above lists, and the staking tokens.
   */
  tokenInfo: (ApiToken & Partial<ApiTokenWithPrice>)[];
  /**
   * Configuration of available explorers for the chain.
   * The configuration does not contain data for NFT addresses, they must be configured separately.
   */
  explorers: ExplorerConfig[];

  /**
   * Configuration of available NFT marketplaces on chain.
   * Implements structure of config for explorers, but NFT-related fields only.
   * Empty, if NFTs are not supported
   */
  marketplaces: MarketplaceConfig[];
  /** Whether the chain supports NFTs */
  isNftSupported: boolean;
  /** Max number of NFTs to request per pagination batch (for NFT-supporting chains) */
  nftBatchLimit?: number;
  /** Pause in ms between NFT pagination batches (for NFT-supporting chains) */
  nftBatchPauseMs?: number;
  /** Brand color used to represent the chain in charts and other multichain visualizations */
  displayColor: string;
  /** Builds a link to transfer assets in this chain. If not set, the chain won't have the Deposit Link modal. */
  formatTransferUrl?(address: string, amount?: bigint, text?: string, jettonAddress?: string): string;

  /**
   * Declarative derivation spec used by the Enclave to derive a public wallet for this chain
   * from a stored BIP39 secret. Bumping `version` marks all stored wallets as in need of
   * re-derivation and triggers the chain-upgrade executor on next authorized entry.
   * Only chains that use the shared chain-upgrade pipeline set this field.
   */
  derivation?: {
    spec: ApiDerivationSpec;
    version: number;
  };
}

// Address-matching precedence order (NOT the display order — see `CHAIN_DISPLAY_ORDER` below).
// A pasted address is matched against chains in this order and the first match wins, so a chain whose
// regex is a subset of another's has to come first.
export const CHAIN_ORDER: ApiChain[] = [
  'ton',
  'bnb',
];

// Display order for chains everywhere in the UI. Independent of `CHAIN_ORDER`,
// which is constrained by address-matching correctness.
// Must contain the same chains as `CHAIN_ORDER`.
export const CHAIN_DISPLAY_ORDER: ApiChain[] = [
  'ton',
  'bnb',
];

const CHAIN_CONFIG: Record<ApiChain, ChainConfig> = {
  ton: {
    title: 'ION',
    isDnsSupported: true,
    isTransferPayloadSupported: true,
    isEncryptedCommentSupported: true,
    canTransferFullNativeBalance: true,
    isLedgerSupported: true,
    ledgerAppName: 'TON',
    isSubwalletsSupported: true,
    defaultDerivationPath: TON_BIP39_PATH,
    isNftSupported: true,
    addressRegex: /^([-\w_]{48}|0:[\da-h]{64})$/i,
    addressPrefixRegex: /^([-\w_]{1,48}|0:[\da-h]{0,64})$/i,
    nativeToken: TONCOIN,
    displayColor: '#2C92F0',
    doesBackendSocketSupport: true,
    canImportTokens: true,
    shouldShowScamWarningIfNotEnoughGas: false,
    doesSupportPushNotifications: true,
    feeCheckAddress: 'UQBE5NzPPnfb6KAy7Rba2yQiuUnihrfcFw96T-p5JtZjAl_c',
    defaultEnabledSlugs: {
      mainnet: [TONCOIN.slug],
      testnet: [TONCOIN.slug],
    },
    tokenInfo: [TONCOIN],
    explorers: [
      {
        id: 'tonscan',
        name: 'Tonscan',
        baseUrl: {
          mainnet: 'https://tonscan.org/',
          testnet: 'https://testnet.tonscan.org/',
        },
        address: '{base}address/{address}',
        token: '{base}jetton/{address}',
        transaction: '{base}tx/{hash}',
        nft: '{base}nft/{address}',
        nftCollection: '{base}collection/{address}',
        doConvertHashFromBase64: true,
      },
      {
        id: 'tonviewer',
        name: 'Tonviewer',
        baseUrl: {
          mainnet: 'https://tonviewer.com/',
          testnet: 'https://testnet.tonviewer.com/',
        },
        address: '{base}{address}?address',
        token: '{base}{address}?jetton',
        transaction: '{base}transaction/{hash}',
        nft: '{base}{address}?nft',
        nftCollection: '{base}{address}?collection',
        doConvertHashFromBase64: true,
      },
    ],
    marketplaces: [{
      id: 'getgems',
      name: 'Getgems',
      baseUrl: {
        mainnet: 'https://getgems.io/',
        testnet: 'https://testnet.getgems.io/',
      },
      nft: '{base}nft/{address}',
      nftCollection: '{base}collection/{address}',
    }],
    nftBatchLimit: 500,
    nftBatchPauseMs: 1000,
    formatTransferUrl: formatTonTransferUrl,
  },
  bnb: {
    title: 'BNB',
    chainStandard: 'bnb',
    isDnsSupported: false,
    isTransferPayloadSupported: false,
    isEncryptedCommentSupported: false,
    canTransferFullNativeBalance: false,
    isLedgerSupported: false,
    isSubwalletsSupported: true,
    defaultDerivationPath: EVM_DERIVATION_PATHS.default,
    addressRegex: /^0x[a-fA-F0-9]{40}$/,
    addressPrefixRegex: /^0x[a-fA-F0-9]{0,40}$/,
    nativeToken: BNB,
    displayColor: '#F39D08',
    doesBackendSocketSupport: false,
    canImportTokens: false,
    shouldShowScamWarningIfNotEnoughGas: false,
    feeCheckAddress: '0x0000000000000000000000000000000000000000',
    defaultEnabledSlugs: {
      mainnet: [BNB.slug, ION_BNB_MAINNET.slug],
      testnet: [BNB.slug],
    },
    // BNB carries ION and nothing else for now: the chain is here to hold the bridged coin, and
    // an open list means every airdropped token lands in the wallet, priced and counted.
    keptTokenSlugs: [ION_BNB_MAINNET.slug],
    tokenInfo: [BNB, ION_BNB_MAINNET],
    explorers: [{
      id: 'bsctrace',
      name: 'BSCTrace',
      baseUrl: {
        mainnet: 'https://bscscan.com/',
        testnet: 'https://testnet.bscscan.com/',
      },
      address: '{base}address/{address}',
      token: '{base}token/{address}',
      nft: '{base}nft/{address}',
      transaction: '{base}tx/{hash}',
      doConvertHashFromBase64: false,
    }],
    marketplaces: [{
      id: 'openSea',
      name: 'OpenSea',
      baseUrl: {
        mainnet: 'https://opensea.io/',
        testnet: '', // No testnet support
      },
      nft: '{base}item/{chain}/{address}',
    }],
    doesSupportPushNotifications: false,
    isNftSupported: true,
  },
};

export const VIEW_ACCOUNT_EVM_PARAM = 'evm';

if (DEBUG) {
  const configKeys = new Set(Object.keys(CHAIN_CONFIG));
  const supportedSet = new Set(CHAIN_ORDER);
  const missing = [...configKeys].filter((k) => !supportedSet.has(k as ApiChain));
  if (missing.length) {
    throw new Error(`SUPPORTED_CHAINS is missing chains from CHAIN_CONFIG: ${missing.join(', ')}`);
  }

  const displaySet = new Set(CHAIN_DISPLAY_ORDER);
  const displayMissing = [...supportedSet].filter((k) => !displaySet.has(k));
  if (displayMissing.length || displaySet.size !== supportedSet.size) {
    throw new Error(`CHAIN_DISPLAY_ORDER must contain the same chains as CHAIN_ORDER: ${displayMissing.join(', ')}`);
  }
}

export function getChainConfig(chain: ApiChain): ChainConfig {
  // The `ApiChain` parameter type is statically narrow, but persisted storage can hold chain
  // keys from older schemas, so guard here so callers see the chain name instead of an opaque
  // `undefined.<prop>` further down the stack
  const config = CHAIN_CONFIG[chain];
  if (!config) {
    throw new Error(`Unsupported chain "${chain}" — not present in CHAIN_CONFIG`);
  }
  return config;
}

export function findChainConfig(chain: string | undefined): ChainConfig | undefined {
  return chain ? CHAIN_CONFIG[chain as ApiChain] : undefined;
}

export function getAvailableExplorers(chain: ApiChain): ExplorerConfig[] {
  return getChainConfig(chain).explorers;
}

export function getAvailableMarketplaces(chain: ApiChain): MarketplaceConfig[] {
  return getChainConfig(chain).marketplaces;
}

export function getExplorer(chain: ApiChain, explorerId?: string): ExplorerConfig {
  const explorers = getAvailableExplorers(chain);

  if (explorerId) {
    const explorer = explorers.find((e) => e.id === explorerId);
    if (explorer) return explorer;
  }

  return explorers[0];
}

export function getMarketplace(chain: ApiChain, id?: string): MarketplaceConfig {
  const marketplaces = getAvailableMarketplaces(chain);

  if (id) {
    const marketplace = marketplaces.find((e) => e.id === id);
    if (marketplace) return marketplace;
  }

  return marketplaces[0];
}

export function getChainTitle(chain: ApiChain) {
  return getChainConfig(chain).title;
}

export function getIsSupportedChain(chain?: string): chain is ApiChain {
  return chain !== undefined && Object.prototype.hasOwnProperty.call(CHAIN_CONFIG, chain);
}

export function getSupportedChains() {
  return CHAIN_ORDER;
}

/** All supported chains in the UI display order (see `CHAIN_DISPLAY_ORDER`) */
export function getDisplayOrderedChains() {
  return CHAIN_DISPLAY_ORDER;
}

export function getChainsByStandard(chainStandard: ApiChain) {
  return getSupportedChains().filter((chain) => getChainConfig(chain).chainStandard === chainStandard);
}

export function getEvmChains() {
  return getChainsByStandard(EVM_CHAIN_STANDARD);
}

export function getIsEvmChain(chain: ApiChain): chain is EVMChain {
  return getChainConfig(chain).chainStandard === EVM_CHAIN_STANDARD;
}

/** Returns the chains supported by the given account in the proper order for showing in the UI */
export function getOrderedAccountChains(byChain: Partial<Record<ApiChain, unknown>>) {
  return getDisplayOrderedChains().filter((chain) => chain in byChain);
}

/** The Ledger app to open for a chain: its own name where it has one, the chain title otherwise */
export function getLedgerAppName(chain: ApiChain) {
  const config = getChainConfig(chain);

  return config.ledgerAppName ?? config.title;
}

export function getChainsSupportingLedger(): ApiChain[] {
  return getSupportedChains()
    .filter((chain) => CHAIN_CONFIG[chain].isLedgerSupported);
}

export const getChainsSupportingNft = /* #__PURE__ */ withCache((): ReadonlySet<ApiChain> => {
  return new Set(
    getSupportedChains()
      .filter((chain) => CHAIN_CONFIG[chain].isNftSupported),
  );
});

/**
 * The tokens a wallet shows whatever its balances are: the native coin of every chain it holds, plus
 * the bridged forms of our own coin. `updateBalances` (`global/reducers/misc.ts`) seeds them at zero,
 * so they stay on screen for an empty wallet and give it somewhere to receive the first funds.
 *
 * A single-chain account passes its own chains, so it is never offered a row it cannot use.
 */
/** Whether the wallet keeps this token, per its chain's `keptTokenSlugs` */
export function getIsTokenKept(chain: ApiChain, slug: string) {
  const { keptTokenSlugs } = getChainConfig(chain);

  return !keptTokenSlugs || keptTokenSlugs.includes(slug);
}

export const getDefaultEnabledSlugs = /* #__PURE__ */ withCache((
  network: ApiNetwork,
  chains?: readonly ApiChain[],
): ReadonlySet<string> => {
  const chainConfigs = chains
    ? chains.filter(getIsSupportedChain).map((chain) => CHAIN_CONFIG[chain])
    : Object.values(CHAIN_CONFIG);

  return new Set(
    chainConfigs.flatMap((chainConfig) => chainConfig.defaultEnabledSlugs[network]),
  );
});

/**
 * The chains a wallet that holds nothing shows: there are no balances to sort or filter by, so it offers
 * everything it supports to receive the first funds in.
 */
export const getAllSupportedVisibleChains = /* #__PURE__ */ withCache((): ReadonlySet<ApiChain> => {
  return new Set(getSupportedChains());
});

/** Returns the tokens from all the chains to fill the token cache until it's loaded from the backend */
export const getTokenInfo = /* #__PURE__ */ withCache((): Readonly<Record<string, ApiTokenWithPrice>> => {
  const commonToken = {
    isFromBackend: true,
    priceUsd: 0,
    percentChange24h: 0,
  };

  const allTokens = Object.values(CHAIN_CONFIG).flatMap((chainConfig) => {
    return chainConfig.tokenInfo.map((token) => ({ ...commonToken, ...token }));
  });

  return buildCollectionByKey(allTokens, 'slug');
});
