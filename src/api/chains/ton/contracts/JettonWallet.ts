import type {
  Address, Cell, Contract, ContractProvider, Sender,
} from '@ton/core';
import {
  beginCell, contractAddress, SendMode, toNano,
} from '@ton/core';

export type JettonWalletConfig = object;

export function jettonWalletConfigToCell(config: JettonWalletConfig): Cell {
  return beginCell().endCell();
}

export class JettonWallet implements Contract {
  constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

  static createFromAddress(address: Address) {
    return new JettonWallet(address);
  }

  static createFromConfig(config: JettonWalletConfig, code: Cell, workchain = 0) {
    const data = jettonWalletConfigToCell(config);
    const init = { code, data };
    return new JettonWallet(contractAddress(workchain, init), init);
  }

  async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell().endCell(),
    });
  }

  async getJettonBalance(provider: ContractProvider) {
    const state = await provider.getState();
    if (state.state.type !== 'active') {
      return 0n;
    }
    const res = await provider.get('get_wallet_data', []);
    return res.stack.readBigNumber();
  }

  static transferMessage(
    jetton_amount: bigint,
    to: Address,
    responseAddress: Address,
    customPayload: Cell | null,
    forward_ton_amount: bigint,
    forwardPayload: Cell | null,
  ) {
    return beginCell().storeUint(0xf8a7ea5, 32).storeUint(0, 64) // op, queryId
      .storeCoins(jetton_amount)
      .storeAddress(to)
      .storeAddress(responseAddress)
      .storeMaybeRef(customPayload)
      .storeCoins(forward_ton_amount)
      .storeMaybeRef(forwardPayload)
      .endCell();
  }

  async sendTransfer(
    provider: ContractProvider,
    via: Sender,
    value: bigint,
    jetton_amount: bigint, to: Address,
    responseAddress: Address,
    customPayload: Cell,
    forward_ton_amount: bigint,
    forwardPayload: Cell,
  ) {
    await provider.internal(via, {
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: JettonWallet.transferMessage(
        jetton_amount, to, responseAddress, customPayload, forward_ton_amount, forwardPayload,
      ),
      value,
    });
  }

  /*
    burn#595f07bc query_id:uint64 amount:(VarUInteger 16)
                  response_destination:MsgAddress custom_payload:(Maybe ^Cell)
                  = InternalMsgBody;
  */
  static burnMessage(jetton_amount: bigint,
    responseAddress: Address,
    customPayload: Cell | null) {
    return beginCell().storeUint(0x595f07bc, 32).storeUint(0, 64) // op, queryId
      .storeCoins(jetton_amount)
      .storeAddress(responseAddress)
      .storeMaybeRef(customPayload)
      .endCell();
  }

  async sendBurn(provider: ContractProvider, via: Sender, value: bigint,
    jetton_amount: bigint,
    responseAddress: Address,
    customPayload: Cell) {
    await provider.internal(via, {
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: JettonWallet.burnMessage(jetton_amount, responseAddress, customPayload),
      value,
    });
  }

  /*
    withdraw_tons#107c49ef query_id:uint64 = InternalMsgBody;
  */
  static withdrawTonsMessage() {
    return beginCell().storeUint(0x6d8e5e3c, 32).storeUint(0, 64) // op, queryId
      .endCell();
  }

  async sendWithdrawTons(provider: ContractProvider, via: Sender) {
    await provider.internal(via, {
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: JettonWallet.withdrawTonsMessage(),
      value: toNano('0.1'),
    });
  }

  /*
    withdraw_jettons#10 query_id:uint64 wallet:MsgAddressInt amount:Coins = InternalMsgBody;
  */
  static withdrawJettonsMessage(from: Address, amount: bigint) {
    return beginCell().storeUint(0x768a50b2, 32).storeUint(0, 64) // op, queryId
      .storeAddress(from)
      .storeCoins(amount)
      .storeMaybeRef(undefined)
      .endCell();
  }

  async sendWithdrawJettons(provider: ContractProvider, via: Sender, from: Address, amount: bigint) {
    await provider.internal(via, {
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: JettonWallet.withdrawJettonsMessage(from, amount),
      value: toNano('0.1'),
    });
  }

  async getWalletData(provider: ContractProvider) {
    const res = await provider.get('get_wallet_data', []);
    const balance = res.stack.readBigNumber();
    const owner = res.stack.readAddress();
    const minter = res.stack.readAddress();
    const code = res.stack.readCell();

    return {
      balance, owner, minter, code,
    };
  }
}
