import { getActions, getGlobal } from '../../global';

import type { GlobalState } from '../../global/types';
import { ContentTab } from '../../global/types';

import { BNB, TONCOIN } from '../../config';
import { INITIAL_STATE } from '../../global/initialState';
import { BSC_USDT_MAINNET, TON_USDT_MAINNET } from '../../../tests/mocks/tokens';
import { callApi } from '../../api';
import { getEvmChains } from '../chain';
import { openUrl } from '../openUrl';
import { getDeeplinkFromLocation, parseTonDeeplink, processDeeplink, processSelfDeeplink } from './index';

// Mock modules
jest.mock('../../global', () => ({
  getActions: jest.fn(),
  getGlobal: jest.fn(),
  setGlobal: jest.fn(),
}));

jest.mock('../../api', () => ({
  callApi: jest.fn(),
}));

jest.mock('../openUrl', () => ({
  openUrl: jest.fn(),
  isSubproject: jest.fn().mockReturnValue(false),
}));

jest.mock('../renderPromise', () => ({
  waitRender: jest.fn().mockResolvedValue(undefined),
}));

// Test constants
const TEST_TON_ADDRESS = 'EQAIsixsrb93f9kDyplo_bK5OdgW5r0WCcIJZdGOUG1B282S';
const TEST_EVM_ADDRESS = '0x9429C8Af1089efD542b313156Af2DFA35c7e0a81';
const TEST_BNB_ADDRESS = '0x0000000000000000000000000000000000000001';
const TEST_DNS_NAME = 'testmywallet.ion';
const TEST_BIN_PAYLOAD = 'te6ccgEBAQEANwAAaV0r640BleSq4Ql3m5OrdlSApYTNRMdDGUFXwTpwZ1oe1G8cPlS_Zym8CwoAdO4mWSned-Fg';
const TEST_STATE_INIT = 'te6ccgEBAgEACwACATQBAQAI_____w\\=\\=';
const TEST_COMMENT = 'ION Wallet';
const TEST_AMOUNT = 1n;

// Test timestamps
const EXPIRED_TIMESTAMP = 946684800; // 1 January 2000 (definitely in the past)
const VALID_TIMESTAMP = 2147483647; // 19 January 2038 (definitely in the future)

// Mock global state for testing
const createMockGlobalState = (): GlobalState => {
  return {
    ...INITIAL_STATE,
    currentAccountId: 'test-account-id',
    accounts: {
      byId: {
        'test-account-id': {
          title: 'Test Account',
          type: 'mnemonic',
          byChain: {
            ton: {
              address: 'EQAIsixsrb93f9kDyplo_bK5OdgW5r0WCcIJZdGOUG1B282S',
            },
            bnb: {
              address: TEST_EVM_ADDRESS,
            },
          },
        },
      },
    },
    tokenInfo: {
      bySlug: {
        [TONCOIN.slug]: {
          ...TONCOIN,
          priceUsd: 1,
          percentChange24h: 1,
        },
        [TON_USDT_MAINNET.slug]: {
          ...TON_USDT_MAINNET,
          priceUsd: 1,
          percentChange24h: 1,
        },
        [BNB.slug]: {
          ...BNB,
          priceUsd: 1,
          percentChange24h: 1,
        },
        [BSC_USDT_MAINNET.slug]: {
          ...BSC_USDT_MAINNET,
          priceUsd: 1,
          percentChange24h: 1,
        },
      },
    },
    byAccountId: {
      'test-account-id': {
        balances: {
          bySlug: {
            [TONCOIN.slug]: 1000000000n, // 1 TON
            [TON_USDT_MAINNET.slug]: 1000000n, // 1 USDT
            [BNB.slug]: 1000000000000000000n, // 1 BNB
            [BSC_USDT_MAINNET.slug]: 1000000000000000000n, // 1 USDT BEP-20
          },
        },
        nfts: {
          byAddress: {},
        },
      },
    },
    settings: {
      ...INITIAL_STATE.settings,
      isTestnet: false,
      byAccountId: {
        'test-account-id': {},
      },
    },
  };
};

describe('parseTonDeeplink', () => {
  it.each([
    {
      name: 'parse TON transfer with binary payload',
      url: `ion://transfer/${TEST_TON_ADDRESS}?amount=1&bin=${TEST_BIN_PAYLOAD}`,
      expected: {
        toAddress: TEST_TON_ADDRESS,
        tokenSlug: TONCOIN.slug,
        amount: TEST_AMOUNT,
        binPayload: TEST_BIN_PAYLOAD,
      },
    },
    {
      name: 'return error for expired transfer link',
      url: `ion://transfer/${TEST_TON_ADDRESS}?amount=1&exp=${EXPIRED_TIMESTAMP}`,
      expected: {
        toAddress: TEST_TON_ADDRESS,
        tokenSlug: TONCOIN.slug,
        amount: TEST_AMOUNT,
        error: '$transfer_link_expired',
      },
    },
    {
      name: 'parse transfer to DNS domain name',
      url: `ion://transfer/${TEST_DNS_NAME}?amount=1`,
      expected: {
        toAddress: TEST_DNS_NAME,
        tokenSlug: TONCOIN.slug,
        amount: TEST_AMOUNT,
      },
    },
    {
      name: 'parse jetton token transfer',
      url: `ion://transfer/${TEST_TON_ADDRESS}?amount=1&jetton=${TON_USDT_MAINNET.tokenAddress}`,
      expected: {
        toAddress: TEST_TON_ADDRESS,
        tokenSlug: TON_USDT_MAINNET.slug,
        amount: TEST_AMOUNT,
      },
    },
    {
      name: 'parse jetton transfer with binary payload',
      url:
        `ion://transfer/${TEST_TON_ADDRESS}?amount=1&jetton=${TON_USDT_MAINNET.tokenAddress}&bin=${TEST_BIN_PAYLOAD}`,
      expected: {
        toAddress: TEST_TON_ADDRESS,
        tokenSlug: TON_USDT_MAINNET.slug,
        amount: TEST_AMOUNT,
        binPayload: TEST_BIN_PAYLOAD,
      },
    },
    {
      name: 'parse transfer with valid expiration timestamp',
      url: `ion://transfer/${TEST_TON_ADDRESS}?amount=1&exp=${VALID_TIMESTAMP}`,
      expected: {
        toAddress: TEST_TON_ADDRESS,
        tokenSlug: TONCOIN.slug,
        amount: TEST_AMOUNT,
      },
    },
    {
      name: 'parse transfer with state initialization data',
      url: `ion://transfer/${TEST_TON_ADDRESS}?amount=1&init=${TEST_STATE_INIT}`,
      expected: {
        toAddress: TEST_TON_ADDRESS,
        tokenSlug: TONCOIN.slug,
        amount: TEST_AMOUNT,
        stateInit: TEST_STATE_INIT,
      },
    },
    {
      name: 'parse jetton transfer with text comment',
      url: `ion://transfer/${TEST_TON_ADDRESS}?amount=1&jetton=${TON_USDT_MAINNET.tokenAddress}&text=${TEST_COMMENT}`,
      expected: {
        toAddress: TEST_TON_ADDRESS,
        tokenSlug: TON_USDT_MAINNET.slug,
        amount: TEST_AMOUNT,
        comment: TEST_COMMENT,
      },
    },
    {
      name: 'parse TON transfer with text comment',
      url: `ion://transfer/${TEST_TON_ADDRESS}?amount=1&text=${TEST_COMMENT}`,
      expected: {
        toAddress: TEST_TON_ADDRESS,
        tokenSlug: TONCOIN.slug,
        amount: TEST_AMOUNT,
        comment: TEST_COMMENT,
      },
    },
    {
      name: 'parse transfer with state initialization and binary payload',
      url: `ion://transfer/${TEST_TON_ADDRESS}?amount=1&init=${TEST_STATE_INIT}&bin=${TEST_BIN_PAYLOAD}`,
      expected: {
        toAddress: TEST_TON_ADDRESS,
        tokenSlug: TONCOIN.slug,
        amount: TEST_AMOUNT,
        stateInit: TEST_STATE_INIT,
        binPayload: TEST_BIN_PAYLOAD,
      },
    },
    {
      name: 'parse transfer with state initialization and text comment',
      url: `ion://transfer/${TEST_TON_ADDRESS}?amount=1&init=${TEST_STATE_INIT}&text=${TEST_COMMENT}`,
      expected: {
        toAddress: TEST_TON_ADDRESS,
        tokenSlug: TONCOIN.slug,
        amount: TEST_AMOUNT,
        stateInit: TEST_STATE_INIT,
        comment: TEST_COMMENT,
      },
    },
    {
      name: 'return error when both text and binary parameters are provided',
      url: `ion://transfer/${TEST_TON_ADDRESS}?amount=1&text=${TEST_COMMENT}&bin=${TEST_BIN_PAYLOAD}`,
      expected: {
        toAddress: TEST_TON_ADDRESS,
        tokenSlug: TONCOIN.slug,
        amount: TEST_AMOUNT,
        comment: TEST_COMMENT,
        binPayload: TEST_BIN_PAYLOAD,
        error: '$transfer_text_and_bin_exclusive',
      },
    },
    {
      name: 'return error when unsupported parameters are provided',
      url: `ion://transfer/${TEST_TON_ADDRESS}?amount=1&unsupported=value&another=param`,
      expected: {
        error: '$unsupported_deeplink_parameter',
      },
    },
  ])('should $name', ({ url, expected }) => {
    const global = createMockGlobalState();
    const result = parseTonDeeplink(url, global);
    expect(result).toEqual(expected);
  });
});

describe('processSelfDeeplink', () => {
  let mockActions: Record<string, jest.Mock>;
  let mockGlobal: GlobalState;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Setup mock actions
    mockActions = {
      startExchange: jest.fn(),
      showError: jest.fn(),
      startStaking: jest.fn(),
      startTransfer: jest.fn(),
      closeSettings: jest.fn(),
      openExplore: jest.fn(),
      setActiveContentTab: jest.fn(),
      openReceiveModal: jest.fn(),
      openTemporaryViewAccount: jest.fn(),
      addSavedAddress: jest.fn(),
    };

    // Setup mock global state
    mockGlobal = createMockGlobalState();

    // Setup getActions and getGlobal mocks
    (getActions as jest.Mock).mockReturnValue(mockActions);
    (getGlobal as jest.Mock).mockReturnValue(mockGlobal);
  });

  describe('Exchange commands', () => {
    it.each(['ion://swap', 'ion://buy-with-crypto'])('opens Exchange for %s', async (url) => {
      expect(await processSelfDeeplink(url)).toBe(true);
      expect(mockActions.startExchange).toHaveBeenCalledTimes(1);
    });
  });

  describe('Stake command', () => {
    it('should start staking', async () => {
      const result = await processSelfDeeplink('ion://stake');

      expect(result).toBe(true);
      expect(mockActions.startStaking).toHaveBeenCalled();
    });

    it('should preserve the exact staking product, asset, and decimal amount', async () => {
      const result = await processSelfDeeplink('ion://stake?product=liquid&asset=toncoin&amount=10');

      expect(result).toBe(true);
      expect(mockActions.startStaking).toHaveBeenCalledWith({
        stakingId: 'liquid',
        tokenSlug: 'toncoin',
        initialAmount: 10_000_000_000n,
      });
    });

    it('should preserve an all-balance staking instruction', async () => {
      const result = await processSelfDeeplink('ion://stake?product=liquid&asset=toncoin&amount=all');

      expect(result).toBe(true);
      expect(mockActions.startStaking).toHaveBeenCalledWith({
        stakingId: 'liquid',
        tokenSlug: 'toncoin',
        initialAmount: 'all',
      });
    });

    it('should reject a partial or invalid exact staking target', async () => {
      const result = await processSelfDeeplink('ion://stake?product=liquid&asset=toncoin&amount=0');

      expect(result).toBe(true);
      expect(mockActions.showError).toHaveBeenCalledWith({ error: '$unsupported_deeplink_parameter' });
      expect(mockActions.startStaking).not.toHaveBeenCalled();
    });

    it('should show error when staking is requested in testnet', async () => {
      mockGlobal.settings.isTestnet = true;

      const result = await processSelfDeeplink('https://wallet.ice.io/stake');

      expect(result).toBe(true);
      expect(mockActions.showError).toHaveBeenCalledWith({
        error: 'Staking is not supported in Testnet.',
      });
      expect(mockActions.startStaking).not.toHaveBeenCalled();
    });
  });

  describe('Checkin command', () => {
    it('should open checkin URL without referral code', async () => {
      const result = await processSelfDeeplink('ion://r/');

      expect(result).toBe(true);
      expect(openUrl).toHaveBeenCalledWith('https://wallet.ice.io/checkin');
    });

    it('should open checkin URL with referral code', async () => {
      const result = await processSelfDeeplink('https://wallet.ice.io/r/ABC123');

      expect(result).toBe(true);
      expect(openUrl).toHaveBeenCalledWith('https://wallet.ice.io/checkin?r=ABC123');
    });
  });

  describe('Receive command', () => {
    it('should open receive modal', async () => {
      const result = await processSelfDeeplink('ion://receive');

      expect(result).toBe(true);
      expect(mockActions.openReceiveModal).toHaveBeenCalled();
    });
  });

  describe('Explore command', () => {
    it('should open explore tab', async () => {
      const result = await processSelfDeeplink('ion://explore');

      expect(result).toBe(true);
      expect(mockActions.closeSettings).toHaveBeenCalled();
      expect(mockActions.openExplore).toHaveBeenCalled();
      expect(mockActions.setActiveContentTab).toHaveBeenCalledWith({ tab: ContentTab.Explore });
    });

    it('should open explore tab with specific host', async () => {
      mockGlobal.exploreData = {
        categories: [],
        sites: [
          {
            url: 'https://example.com',
            name: 'Example',
            icon: '',
            manifestUrl: '',
            description: '',
            canBeRestricted: false,
            isExternal: false,
          },
        ],
      };

      const result = await processSelfDeeplink('https://wallet.ice.io/explore/example.com');

      expect(result).toBe(true);
      expect(mockActions.openExplore).toHaveBeenCalled();
      expect(openUrl).toHaveBeenCalledWith('https://example.com');
    });
  });

  describe('View command', () => {
    it('should open temporary view account with single address', async () => {
      const result = await processSelfDeeplink(`ion://view/?ton=${TEST_TON_ADDRESS}`);

      expect(result).toBe(true);
      expect(mockActions.openTemporaryViewAccount).toHaveBeenCalledWith({
        addressByChain: {
          ton: TEST_TON_ADDRESS,
        },
      });
    });

    it('should open temporary view account with multiple addresses', async () => {
      const url = `https://wallet.ice.io/view/?ton=${TEST_TON_ADDRESS}&bnb=${TEST_EVM_ADDRESS}`;
      const result = await processSelfDeeplink(url);

      expect(result).toBe(true);
      expect(mockActions.openTemporaryViewAccount).toHaveBeenCalled();
      const callArg = mockActions.openTemporaryViewAccount.mock.calls[0][0];
      expect(callArg.addressByChain.ton).toBeDefined();
      expect(callArg.addressByChain.bnb).toBeDefined();
    });

    it('should open temporary view account with evm address expanded to all EVM chains', async () => {
      const url = `https://wallet.ice.io/view/?evm=${TEST_EVM_ADDRESS}&ton=${TEST_TON_ADDRESS}`;
      const result = await processSelfDeeplink(url);

      expect(result).toBe(true);
      expect(mockActions.openTemporaryViewAccount).toHaveBeenCalled();
      const callArg = mockActions.openTemporaryViewAccount.mock.calls[0][0];
      expect(callArg.addressByChain.ton).toBe(TEST_TON_ADDRESS);
      getEvmChains().forEach((chain) => {
        expect(callArg.addressByChain[chain]).toBe(TEST_EVM_ADDRESS);
      });
    });

    it('should prefer explicit EVM chain address over generic evm address', async () => {
      const url = `https://wallet.ice.io/view/?evm=${TEST_EVM_ADDRESS}&bnb=${TEST_BNB_ADDRESS}`;
      const result = await processSelfDeeplink(url);

      expect(result).toBe(true);
      expect(mockActions.openTemporaryViewAccount).toHaveBeenCalled();
      const callArg = mockActions.openTemporaryViewAccount.mock.calls[0][0];
      expect(callArg.addressByChain.bnb).toBe(TEST_BNB_ADDRESS);
    });

    it('should show error when no valid addresses provided', async () => {
      const result = await processSelfDeeplink('ion://view/');

      expect(result).toBe(false);
      expect(mockActions.showError).toHaveBeenCalledWith({
        error: '$no_valid_view_addresses',
      });
    });

    it('should show error when all provided addresses are invalid', async () => {
      const result = await processSelfDeeplink('ion://view/?ton=invalid-address');

      expect(result).toBe(false);
      expect(mockActions.showError).toHaveBeenCalledWith({
        error: '$no_valid_view_addresses',
      });
    });

    it('should decode URI-encoded addresses', async () => {
      const encodedUrl = `https://wallet.ice.io/view/?ton=${encodeURIComponent(TEST_TON_ADDRESS)}`;
      const result = await processSelfDeeplink(encodedUrl);

      expect(result).toBe(true);
      expect(mockActions.openTemporaryViewAccount).toHaveBeenCalledWith({
        addressByChain: {
          ton: TEST_TON_ADDRESS,
        },
      });
    });
  });

  describe('Transfer command', () => {
    it('should process transfer deeplink', async () => {
      const result = await processSelfDeeplink(`ion://transfer/${TEST_TON_ADDRESS}?amount=1`);

      expect(result).toBe(true);
      expect(mockActions.startTransfer).toHaveBeenCalledWith(
        expect.objectContaining({
          toAddress: TEST_TON_ADDRESS,
          tokenSlug: TONCOIN.slug,
          amount: 1n,
        }),
      );
    });

    it('should process transfer with https://wallet.ice.io protocol', async () => {
      const url = `https://wallet.ice.io/transfer/${TEST_TON_ADDRESS}?amount=5&text=Hello`;
      const result = await processSelfDeeplink(url);

      expect(result).toBe(true);
      expect(mockActions.startTransfer).toHaveBeenCalledWith(
        expect.objectContaining({
          toAddress: TEST_TON_ADDRESS,
          tokenSlug: TONCOIN.slug,
          amount: 5n,
          comment: 'Hello',
        }),
      );
    });
  });

  describe('In-app browser source boundary', () => {
    it('should not start offramp transfer from in-app browser self deeplink', async () => {
      await processDeeplink(
        `ion://offramp?depositWalletAddress=${TEST_TON_ADDRESS}&baseCurrencyCode=ton&baseCurrencyAmount=1`,
        true,
      );

      expect(mockActions.addSavedAddress).not.toHaveBeenCalled();
      expect(mockActions.startTransfer).not.toHaveBeenCalled();
    });

    it('should still process regular transfer deeplinks from in-app browser', async () => {
      await processDeeplink(`ion://transfer/${TEST_TON_ADDRESS}?amount=1&text=${TEST_COMMENT}`, true);

      expect(mockActions.startTransfer).toHaveBeenCalledWith(
        expect.objectContaining({
          toAddress: TEST_TON_ADDRESS,
          tokenSlug: TONCOIN.slug,
          amount: 1n,
          comment: TEST_COMMENT,
        }),
      );
      expect(mockActions.addSavedAddress).not.toHaveBeenCalled();
    });
  });

  describe('Invalid deeplinks', () => {
    it('should return false for unknown commands', async () => {
      const result = await processSelfDeeplink('ion://unknown-command');

      expect(result).toBe(false);
    });

    it('should return false for malformed URLs', async () => {
      const result = await processSelfDeeplink('not-a-valid-url');

      expect(result).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      (getGlobal as jest.Mock).mockImplementation(() => {
        throw new Error('Test error');
      });

      const result = await processSelfDeeplink('ion://swap');

      expect(result).toBe(false);
    });
  });

  describe('Protocol variations', () => {
    it('should handle ion:// protocol', async () => {
      const result = await processSelfDeeplink('ion://stake');

      expect(result).toBe(true);
      expect(mockActions.startStaking).toHaveBeenCalled();
    });

    it('should handle https://wallet.ice.io protocol', async () => {
      const result = await processSelfDeeplink('https://wallet.ice.io/stake');

      expect(result).toBe(true);
      expect(mockActions.startStaking).toHaveBeenCalled();
    });

    it('should handle https://go.wallet.ice.io protocol', async () => {
      const result = await processSelfDeeplink('https://go.wallet.ice.io/stake');

      expect(result).toBe(true);
      expect(mockActions.startStaking).toHaveBeenCalled();
    });

    it('should convert http:// to https://', async () => {
      const result = await processSelfDeeplink('http://wallet.ice.io/stake');

      expect(result).toBe(true);
      expect(mockActions.startStaking).toHaveBeenCalled();
    });
  });
});

describe('processSelfDeeplink Transaction command', () => {
  let mockActions: Record<string, jest.Mock>;
  let mockGlobal: GlobalState;
  let mockActivities: any[];

  beforeEach(() => {
    jest.clearAllMocks();

    mockActions = {
      showError: jest.fn(),
      openTransactionInfo: jest.fn(),
      openTemporaryViewAccount: jest.fn(),
    };

    mockGlobal = createMockGlobalState();
    mockActivities = [{
      kind: 'transaction',
      toAddress: 'EQAIsixsrb93f9kDyplo_bK5OdgW5r0WCcIJZdGOUG1B282S',
      txId: 'mock-tx-id',
    }];

    (getActions as jest.Mock).mockReturnValue(mockActions);
    (getGlobal as jest.Mock).mockReturnValue(mockGlobal);
    (callApi as jest.Mock).mockImplementation((method: string) => {
      if (method === 'fetchTransactionById') {
        return Promise.resolve(mockActivities);
      }
      return undefined;
    });
  });

  describe('TON transaction links', () => {
    it('should open transaction info for valid TON transaction', async () => {
      const txId = '+YqE7Rejq4CIwK+2UyEgdnSdPwyaYV23wFJd9T6cTxw=';
      const result = await processSelfDeeplink(`ion://tx/ton/${txId}`);

      expect(result).toBe(true);
      expect(mockActions.openTransactionInfo).toHaveBeenCalledWith({
        txId,
        chain: 'ton',
        activities: mockActivities,
      });
    });

    it('should decode URL-encoded transaction ID', async () => {
      const txId = '+YqE7Rejq4CIwK+2UyEgdnSdPwyaYV23wFJd9T6cTxw=';
      const encodedTxId = encodeURIComponent(txId);
      const result = await processSelfDeeplink(`https://wallet.ice.io/tx/ton/${encodedTxId}`);

      expect(result).toBe(true);
      expect(mockActions.openTransactionInfo).toHaveBeenCalledWith({
        txId,
        chain: 'ton',
        activities: mockActivities,
      });
    });

    it('should handle transaction with special characters in ID', async () => {
      const txId = 'CAm70iims+RRf4Xe7r7jIWJd9Jk03AzFmUOntM/aK7U=';
      const result = await processSelfDeeplink(`ion://tx/ton/${txId}`);

      expect(result).toBe(true);
      expect(mockActions.openTransactionInfo).toHaveBeenCalledWith({
        txId,
        chain: 'ton',
        activities: mockActivities,
      });
    });

    it('should return true and show error when transaction is not found', async () => {
      (callApi as jest.Mock).mockImplementation((method: string) => {
        if (method === 'fetchTransactionById') {
          return Promise.resolve([]);
        }
        return undefined;
      });

      const result = await processSelfDeeplink('ion://tx/ton/nonexistent-tx-id');

      expect(result).toBe(true);
      expect(mockActions.showError).toHaveBeenCalledWith({ error: '$transaction_not_found' });
      expect(mockActions.openTransactionInfo).not.toHaveBeenCalled();
    });
  });

  describe('BNB transaction links', () => {
    it('should open transaction info for valid BNB transaction', async () => {
      const txId = '0xa73f1e0711d6b75ea547791dda39655de1264c8bd92bc57a2710fc49651a988c';
      const result = await processSelfDeeplink(`ion://tx/bnb/${txId}`);

      expect(result).toBe(true);
      expect(mockActions.openTransactionInfo).toHaveBeenCalledWith({
        txId,
        chain: 'bnb',
        activities: mockActivities,
      });
    });

    it('should handle BNB transaction with https://wallet.ice.io protocol', async () => {
      const txId = '0xe4ef5753570a58e06ee3585bb4027820cadf1e97e3b29a22871961d0c0ac6275';
      const result = await processSelfDeeplink(`https://wallet.ice.io/tx/bnb/${txId}`);

      expect(result).toBe(true);
      expect(mockActions.openTransactionInfo).toHaveBeenCalledWith({
        txId,
        chain: 'bnb',
        activities: mockActivities,
      });
    });
  });

  describe('Invalid transaction links', () => {
    it('should return false for invalid chain and show error', async () => {
      const result = await processSelfDeeplink('ion://tx/banana/zzz');

      expect(result).toBe(false);
      expect(mockActions.openTransactionInfo).not.toHaveBeenCalled();
      expect(mockActions.showError).toHaveBeenCalledWith({ error: '$unsupported_chain' });
    });

    it('should return false for missing txId', async () => {
      const result = await processSelfDeeplink('ion://tx/ton');

      expect(result).toBe(false);
      expect(mockActions.openTransactionInfo).not.toHaveBeenCalled();
    });

    it('should return false for missing chain', async () => {
      const result = await processSelfDeeplink('ion://tx');

      expect(result).toBe(false);
      expect(mockActions.openTransactionInfo).not.toHaveBeenCalled();
    });

    it('should return false for empty txId', async () => {
      const result = await processSelfDeeplink('ion://tx/ton/');

      expect(result).toBe(false);
      expect(mockActions.openTransactionInfo).not.toHaveBeenCalled();
    });
  });

  describe('Protocol variations', () => {
    it('should handle ion:// protocol', async () => {
      const txId = 'testTxId123';
      const result = await processSelfDeeplink(`ion://tx/ton/${txId}`);

      expect(result).toBe(true);
      expect(mockActions.openTransactionInfo).toHaveBeenCalledWith({
        txId,
        chain: 'ton',
        activities: mockActivities,
      });
    });

    it('should handle https://wallet.ice.io protocol', async () => {
      const txId = 'testTxId456';
      const result = await processSelfDeeplink(`https://wallet.ice.io/tx/ton/${txId}`);

      expect(result).toBe(true);
      expect(mockActions.openTransactionInfo).toHaveBeenCalledWith({
        txId,
        chain: 'ton',
        activities: mockActivities,
      });
    });
  });
});

describe('getDeeplinkFromLocation', () => {
  const mockLocation = (pathname: string, search: string) => {
    window.history.replaceState({}, '', `${pathname}${search}`);
  };

  it.each([
    {
      name: 'return undefined for root path without search params',
      pathname: '/',
      search: '',
      expected: undefined,
    },
    {
      name: 'handle swap command with query params',
      pathname: '/swap',
      search: '?in=toncoin&out=ton-usdt&amount=100',
      expected: 'ion://swap?in=toncoin&out=ton-usdt&amount=100',
    },
    {
      name: 'handle transfer command with address',
      pathname: `/transfer/${TEST_TON_ADDRESS}`,
      search: '?amount=1&text=Hello',
      expected: `ion://transfer/${TEST_TON_ADDRESS}?amount=1&text=Hello`,
    },
    {
      name: 'handle root path with search params only',
      pathname: '/',
      search: '?foo=bar',
      expected: 'ion://?foo=bar',
    },
    {
      name: 'handle tx command with chain and txId',
      pathname: '/tx/ton/testTxId123',
      search: '',
      expected: 'ion://tx/ton/testTxId123',
    },
    {
      name: 'handle view command with addresses',
      pathname: '/view/',
      search: `?ton=${TEST_TON_ADDRESS}`,
      expected: `ion://view/?ton=${TEST_TON_ADDRESS}`,
    },
    {
      name: 'handle receive command',
      pathname: '/receive',
      search: '',
      expected: 'ion://receive',
    },
  ])('should $name', ({ pathname, search, expected }) => {
    mockLocation(pathname, search);

    const result = getDeeplinkFromLocation();

    expect(result).toBe(expected);
  });
});

describe('View-only mode deeplink blocking', () => {
  let mockActions: Record<string, jest.Mock>;
  let mockGlobal: GlobalState;

  beforeEach(() => {
    jest.clearAllMocks();

    mockActions = {
      startExchange: jest.fn(),
      showError: jest.fn(),
      startStaking: jest.fn(),
      startTransfer: jest.fn(),
      closeSettings: jest.fn(),
      openExplore: jest.fn(),
      setActiveContentTab: jest.fn(),
      openReceiveModal: jest.fn(),
      openTemporaryViewAccount: jest.fn(),
      showTokenActivity: jest.fn(),
      addSavedAddress: jest.fn(),
      openLoadingOverlay: jest.fn(),
      closeLoadingOverlay: jest.fn(),
    };

    mockGlobal = {
      ...createMockGlobalState(),
      accounts: {
        byId: {
          'test-account-id': {
            title: 'View Account',
            type: 'view',
            byChain: {
              ton: {
                address: TEST_TON_ADDRESS,
              },
              bnb: {
                address: TEST_EVM_ADDRESS,
              },
            },
          },
        },
      },
    };

    (getActions as jest.Mock).mockReturnValue(mockActions);
    (getGlobal as jest.Mock).mockReturnValue(mockGlobal);
  });

  describe('processSelfDeeplink blocks signing commands', () => {
    it.each([
      { name: 'Swap', url: 'ion://swap' },
      { name: 'BuyWithCrypto', url: 'ion://buy-with-crypto' },
      { name: 'BuyWithCard', url: 'ion://buy-with-card' },
      { name: 'SellOnCard', url: 'ion://sell-on-card' },
      { name: 'Stake', url: 'ion://stake' },
      { name: 'Transfer', url: `ion://transfer/${TEST_TON_ADDRESS}?amount=1` },
      { name: 'Offramp', url: 'ion://offramp?depositWalletAddress=addr&baseCurrencyCode=ton' },
      { name: 'Receive', url: 'ion://receive' },
    ])('should block $name in view-only mode', async ({ url }) => {
      const result = await processSelfDeeplink(url);

      expect(result).toBe(false);
      expect(mockActions.showError).toHaveBeenCalledWith({
        error: '$action_not_available_view_mode',
      });
    });

    it('should not open exchange in view-only mode', async () => {
      await processSelfDeeplink('ion://swap');
      expect(mockActions.startExchange).not.toHaveBeenCalled();
    });

    it('should not call addSavedAddress for offramp in view-only mode', async () => {
      await processSelfDeeplink('ion://offramp?depositWalletAddress=addr&baseCurrencyCode=ton');
      expect(mockActions.addSavedAddress).not.toHaveBeenCalled();
      expect(mockActions.startTransfer).not.toHaveBeenCalled();
    });
  });

  describe('processDeeplink blocks transfer protocols', () => {
    it('should block ion:// transfer in view-only mode', async () => {
      const result = await processDeeplink(`ion://transfer/${TEST_TON_ADDRESS}?amount=1`);

      expect(result).toBe(false);
      expect(mockActions.showError).toHaveBeenCalledWith({
        error: '$action_not_available_view_mode',
      });
      expect(mockActions.startTransfer).not.toHaveBeenCalled();
    });

    it('should block ion://transfer widget shortcut in view-only mode', async () => {
      const result = await processDeeplink('ion://transfer');

      expect(result).toBe(false);
      expect(mockActions.showError).toHaveBeenCalledWith({
        error: '$action_not_available_view_mode',
      });
      expect(mockActions.startTransfer).not.toHaveBeenCalled();
    });
  });

  describe('processDeeplink blocks dapp connector protocols', () => {
    it.each([
      { name: 'ION Gateway (tc://)', url: 'tc://some-dapp-request' },
      { name: 'ION Gateway (ion-gateway://)', url: 'ion-gateway://some-dapp-request' },
      { name: 'WalletConnect (wc:)', url: 'wc:some-session-request' },
    ])('should block $name in view-only mode', async ({ url }) => {
      const result = await processDeeplink(url);

      expect(result).toBe(false);
      expect(mockActions.showError).toHaveBeenCalledWith({
        error: '$action_not_available_view_mode',
      });
      expect(mockActions.openLoadingOverlay).not.toHaveBeenCalled();
    });
  });
});
