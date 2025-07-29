import type { Address, Cell, Contract, ContractProvider, Sender } from '@ton/core';
import { beginCell, contractAddress, Dictionary, SendMode } from '@ton/core';

export const Opcodes = {
  JETTON_TRANSFER: 0xf8a7ea5,
  JETTON_TRANSFER_NOTIFICATION: 0x7362d09c,
  SET_ACL: 0x996c7334,
  SUDOER_REQUEST: 0x5e2a5f0a,
  CREATE_CHECK: 0x6a3f7c7f,
  CASH_CHECK: 0x69e7ac28,
};

export const Errors = {
  // op::set_jetton_wallets
  JETTON_WALLETS_ALREADY_SET: 400,
  UNAUTHORIZED_JETTON_WALLET: 401,
  MISSING_FORWARD_PAYLOAD: 402,
  INVALID_FORWARD_PAYLOAD: 403,
  INVALID_FORWARD_OPERATION: 404,

  // op::create_check error codes
  CHECK_ALREADY_EXISTS: 410,
  INSUFFICIENT_FUNDS: 411,

  // op::cash_check error codes
  CHECK_NOT_FOUND: 420,
  INVALID_RECEIVER_ADDRESS: 421,
  INCORRECT_SIGNATURE: 422,
  AUTH_DATE_TOO_OLD: 423,
  CHAT_INSTANCE_MISMATCH: 424,
  USERNAME_MISMATCH: 425,
  UNAUTHORIZED_SENDER: 430,
};

export const Fees = {
  TON_CREATE_GAS: 1000000n, // 0.001 TON
  TON_CASH_GAS: 3000000n, // 0.003 TON
  TON_TRANSFER: 3000000n, // 0.003 TON
  JETTON_CREATE_GAS: 3000000n, // 0.003 TON
  JETTON_CASH_GAS: 7000000n, // 0.007 TON
  JETTON_TRANSFER: 50000000n, // 0.05 TON
  TINY_JETTON_TRANSFER: 18000000n, // 0.018 TON
};

export function getAddressHash(address: Address): bigint {
  return BigInt(`0x${address.hash.toString('hex')}`);
}

export function createDefaultPushEscrowConfig(sudoer: Address): PushEscrowConfig {
  return {
    sudoer,
  };
}

export enum CheckStatus {
  PENDING = 0,
}

export type CheckInfo = {
  amount: bigint;
  jettonWalletAddress?: Address;
  withUsername: boolean;
  chatInstance?: string;
  username?: string;
  comment?: string;
  status: CheckStatus;
  createdAt: number;
  senderAddress?: Address; // Optional for v1
};

export type PushEscrowConfig = {
  sudoer: Address;
};

export function pushEscrowConfigToCell(config: PushEscrowConfig): Cell {
  return beginCell()
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

    let cellBuilder = beginCell()
      .storeUint(Opcodes.CREATE_CHECK, 32)
      .storeUint(opts.checkId, 32)
      .storeBit(withUsername);

    if (withUsername) {
      cellBuilder = cellBuilder.storeStringRefTail(opts.username!);
    } else {
      cellBuilder = cellBuilder.storeInt(BigInt(opts.chatInstance!), 64);
    }

    // Add comment as a reference cell (empty string if not provided)
    cellBuilder = cellBuilder.storeStringRefTail(opts.comment ?? '');

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
      .storeUint(opts.checkId, 32)
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
    const chatInstance = result.stack.readBigNumberOpt()?.toString();
    const username = result.stack.readCellOpt()?.beginParse().loadStringTail();
    const comment = result.stack.readCell().beginParse().loadStringTail() || undefined;
    const status = result.stack.readNumber() as CheckStatus;
    const createdAt = result.stack.readNumber();
    const senderAddress = result.stack.readCellOpt()?.beginParse().loadAddress();

    return {
      amount,
      jettonWalletAddress,
      withUsername,
      chatInstance,
      username,
      comment,
      status,
      createdAt,
      senderAddress,
    };
  }
}
