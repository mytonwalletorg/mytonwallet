import type { Address, Cell, Contract, ContractProvider, Sender } from '@ton/core';
import { beginCell, contractAddress, Dictionary, SendMode } from '@ton/core';

const ID_SIZE = 20;
export const CANCEL_FEE = 100000000n;

export const Opcodes = {
  JETTON_TRANSFER: 0xf8a7ea5,
  JETTON_TRANSFER_NOTIFICATION: 0x7362d09c,
  SET_ACL: 0x996c7334,
  SUDOER_REQUEST: 0x5e2a5f0a,
  CREATE_CHECK: 0x6a3f7c7f,
  CASH_CHECK: 0x69e7ac28,
  CANCEL_CHECK: 0x4a1c5e3b,
};

export const Errors = {
  // op::set_jetton_wallets
  UNAUTHORIZED_SUDOER: 400,

  // op::create_check error codes
  CHECK_ALREADY_EXISTS: 410,
  INSUFFICIENT_FUNDS: 411,
  INVALID_PAYLOAD: 412,
  INVALID_OP: 413,
  MISSING_FORWARD_PAYLOAD: 414,

  // op::cash_check error codes
  CHECK_NOT_FOUND: 420,
  INVALID_RECEIVER_ADDRESS: 421,
  INCORRECT_SIGNATURE: 422,
  AUTH_DATE_TOO_OLD: 423,
  CHAT_INSTANCE_MISMATCH: 424,
  USERNAME_MISMATCH: 425,
  UNAUTHORIZED_JETTON_WALLET: 426,

  // op::cancel_check error codes
  UNAUTHORIZED_CANCEL: 430,
  INSUFFICIENT_CANCEL_FEE: 431,
};

export const Fees = {
  TON_CREATE_GAS: 6000000n, // 0.006 TON
  TON_CASH_GAS: 8000000n, // 0.008 TON
  TON_TRANSFER: 3000000n, // 0.003 TON
  TON_CANCEL: 100000000n, // 0.1 TON
  JETTON_CREATE_GAS: 7000000n, // 0.007 TON
  JETTON_CASH_GAS: 9000000n, // 0.009 TON
  JETTON_TRANSFER: 50000000n, // 0.05 TON
  TINY_JETTON_TRANSFER: 18000000n, // 0.018 TON
};

export function getAddressHash(address: Address): bigint {
  return BigInt(`0x${address.hash.toString('hex')}`);
}

export function createDefaultPushEscrowConfig(instanceId: number, sudoer: Address): PushEscrowConfig {
  return {
    instanceId,
    sudoer,
  };
}

export type CheckInfo = {
  amount: bigint;
  jettonWalletAddress?: Address;
  withUsername: boolean;
  chatInstance?: string;
  username?: string;
  comment?: string;
  createdAt: number;
  senderAddress: Address;
};

export type PushEscrowConfig = {
  instanceId: number;
  sudoer: Address;
};

export function pushEscrowConfigToCell(config: PushEscrowConfig): Cell {
  return beginCell()
    .storeUint(config.instanceId, 32)
    .storeAddress(config.sudoer)
    // eslint-disable-next-line no-null/no-null
    .storeAddress(null) // usdt_jetton_wallet (initially null)
    // eslint-disable-next-line no-null/no-null
    .storeAddress(null) // my_jetton_wallet (initially null)
    .storeDict(
      Dictionary.empty(Dictionary.Keys.Uint(32), Dictionary.Values.Cell()),
    )
    .endCell();
}

export class PushEscrow implements Contract {
  constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {
  }

  static createFromAddress(address: Address) {
    return new PushEscrow(address);
  }

  static createFromConfig(config: PushEscrowConfig, code: Cell, workchain = 0) {
    const data = pushEscrowConfigToCell(config);
    const init = { code, data };
    return new PushEscrow(contractAddress(workchain, init), init);
  }

  async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell().endCell(),
    });
  }

  async getBalance(provider: ContractProvider) {
    return (await provider.getState()).balance;
  }

  static prepareCreateCheck(
    opts: {
      checkId: number;
      chatInstance?: string;
      username?: string;
      comment?: string;
    },
  ) {
    const withUsername = opts.username !== undefined;

    const cellBuilder = beginCell()
      .storeUint(Opcodes.CREATE_CHECK, 32)
      .storeUint(opts.checkId, ID_SIZE)
      .storeBit(withUsername)
      .storeStringRefTail(withUsername ? opts.username! : opts.chatInstance!)
      .storeStringRefTail(opts.comment ?? '');

    return cellBuilder.endCell();
  }

  async sendCreateCheck(
    provider: ContractProvider,
    via: Sender,
    opts: {
      checkId: number;
      chatInstance?: string;
      username?: string;
      comment?: string;
      value: bigint;
    },
  ) {
    const body = PushEscrow.prepareCreateCheck(opts);

    await provider.internal(via, {
      value: opts.value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body,
    });
  }

  static prepareCreateJettonCheck(
    opts: {
      checkId: number;
      amount: bigint;
      chatInstance?: string;
      username?: string;
      comment?: string;
    },
    originalSenderAddress: Address,
  ) {
    return beginCell()
      .storeUint(Opcodes.JETTON_TRANSFER_NOTIFICATION, 32)
      .storeUint(0, 64) // query_id
      .storeCoins(opts.amount)
      .storeAddress(originalSenderAddress)
      .storeRef(PushEscrow.prepareCreateJettonCheckForwardPayload(opts))
      .endCell();
  }

  static prepareCreateJettonCheckForwardPayload(
    opts: {
      checkId: number;
      chatInstance?: string;
      username?: string;
      comment?: string;
    },
  ) {
    return PushEscrow.prepareCreateCheck(opts);
  }

  async sendCashCheck(
    provider: ContractProvider,
    opts: {
      checkId: number;
      authDate: string;
      chatInstance?: string;
      username?: string;
      receiverAddress: Address;
      signature: Buffer;
    },
  ) {
    const messageBody = beginCell()
      .storeUint(Opcodes.CASH_CHECK, 32)
      .storeUint(opts.checkId, ID_SIZE)
      .storeStringRefTail(opts.authDate)
      .storeStringRefTail(opts.chatInstance || opts.username!)
      .storeAddress(opts.receiverAddress)
      .storeBuffer(opts.signature)
      .endCell();

    try {
      return await provider.external(messageBody);
    } catch (error: any) {
      const exitCode = error.exitCode || 500;
      const errorMessage = `External message not accepted by smart contract\nExit code: ${exitCode}`;
      throw new Error(errorMessage);
    }
  }

  async sendCancelCheck(
    provider: ContractProvider,
    via: Sender,
    opts: {
      checkId: number;
    },
    overrideValue?: bigint,
  ) {
    await provider.internal(via, {
      value: overrideValue ?? CANCEL_FEE,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: PushEscrow.prepareCancelCheck(opts),
    });
  }

  static prepareCancelCheck(opts: { checkId: number }) {
    return beginCell()
      .storeUint(Opcodes.CANCEL_CHECK, 32)
      .storeUint(opts.checkId, ID_SIZE)
      .endCell();
  }

  async sendSetAcl(
    provider: ContractProvider,
    via: Sender,
    opts: {
      sudoer: Address | null;
      usdtJettonWallet: Address | null;
      myJettonWallet: Address | null;
      value: bigint;
    },
  ) {
    const messageBody = beginCell()
      .storeUint(Opcodes.SET_ACL, 32)
      .storeAddress(opts.sudoer)
      .storeAddress(opts.usdtJettonWallet)
      .storeAddress(opts.myJettonWallet)
      .endCell();

    await provider.internal(via, {
      value: opts.value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: messageBody,
    });
  }

  async sendSudoerRequest(
    provider: ContractProvider,
    via: Sender,
    opts: {
      message: Cell;
      mode: number;
      value: bigint;
    },
  ) {
    const messageBody = beginCell()
      .storeUint(Opcodes.SUDOER_REQUEST, 32)
      .storeRef(opts.message)
      .storeUint(opts.mode, 8)
      .endCell();

    await provider.internal(via, {
      value: opts.value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: messageBody,
    });
  }

  // Get method to retrieve check information - this version is used by `SandboxContract`
  async getCheckInfo(checkId: number): Promise<CheckInfo>;

  // This version is used directly with a provider
  async getCheckInfo(provider: ContractProvider, checkId: number): Promise<CheckInfo>;

  // Implementation handling both cases
  async getCheckInfo(providerOrCheckId: ContractProvider | number, maybeCheckId?: number): Promise<CheckInfo> {
    let provider: ContractProvider;
    let checkId: number;

    if (typeof providerOrCheckId === 'number') {
      provider = (this as any).provider;
      checkId = providerOrCheckId;
    } else {
      provider = providerOrCheckId;
      checkId = maybeCheckId as number;
    }

    const result = await provider.get('get_check_info', [
      { type: 'int', value: BigInt(checkId) },
    ]);

    const amount = result.stack.readBigNumber();

    let jettonWalletAddress: Address | undefined;

    try {
      const jettonCell = result.stack.readCell();
      // If cell isn't empty and has enough data for an address, try to load it
      if (jettonCell && !jettonCell.equals(beginCell().endCell())) {
        const slice = jettonCell.beginParse();
        if (slice.remainingBits >= 267) { // minimum bits for an address
          jettonWalletAddress = slice.loadAddress();
        }
      }
    } catch (err) {
      // Jetton address is undefined if there's any error
      // This is expected in some cases, so no need to log
    }

    const withUsername = result.stack.readBoolean();
    const chatOrUsername = result.stack.readCell().beginParse().loadStringTail();
    const chatInstance = withUsername ? undefined : chatOrUsername;
    const username = withUsername ? chatOrUsername : undefined;
    const comment = result.stack.readCell().beginParse().loadStringTail() || undefined;
    const createdAt = result.stack.readNumber();
    const senderAddress = result.stack.readCell().beginParse().loadAddress();

    return {
      amount,
      jettonWalletAddress,
      withUsername,
      chatInstance,
      username,
      comment,
      createdAt,
      senderAddress,
    };
  }
}
