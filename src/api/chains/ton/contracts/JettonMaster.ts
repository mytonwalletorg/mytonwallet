import type {
  Address, Cell, Contract, ContractProvider, Sender,
} from '@ton/core';
import {
  beginCell, contractAddress, SendMode, toNano,
} from '@ton/core';

import { Op } from './JettonConstants';

export type JettonMinterContent = {
  type: 0 | 1;
  uri: string;
};

export type JettonMinterConfig = { admin: Address; content: Cell; wallet_code: Cell };

export function jettonMinterConfigToCell(config: JettonMinterConfig): Cell {
  return beginCell()
    .storeCoins(0)
    .storeAddress(config.admin)
    .storeRef(config.content)
    .storeRef(config.wallet_code)
    .endCell();
}

export function jettonContentToCell(content: JettonMinterContent) {
  return beginCell()
    .storeUint(content.type, 8)
    .storeStringTail(content.uri) // Snake logic under the hood
    .endCell();
}

export class JettonMinter implements Contract {
  constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

  static createFromAddress(address: Address) {
    return new JettonMinter(address);
  }

  static createFromConfig(config: JettonMinterConfig, code: Cell, workchain = 0) {
    const data = jettonMinterConfigToCell(config);
    const init = { code, data };
    return new JettonMinter(contractAddress(workchain, init), init);
  }

  async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell().endCell(),
    });
  }

  protected static jettonInternalTransfer(jetton_amount: bigint,
    forward_ton_amount: bigint,
    response_addr?: Address,
    query_id: number | bigint = 0) {
    return beginCell()
      .storeUint(Op.internal_transfer, 32)
      .storeUint(query_id, 64)
      .storeCoins(jetton_amount)
      .storeAddress(undefined)
      .storeAddress(response_addr)
      .storeCoins(forward_ton_amount)
      .storeBit(false)
      .endCell();
  }

  static mintMessage(
    from: Address,
    to: Address,
    jetton_amount: bigint,
    forward_ton_amount: bigint,
    total_ton_amount: bigint,
    query_id: number | bigint = 0,
  ) {
    const mintMsg = beginCell().storeUint(Op.internal_transfer, 32)
      .storeUint(0, 64)
      .storeCoins(jetton_amount)
      .storeAddress(undefined)
      .storeAddress(from) // Response addr
      .storeCoins(forward_ton_amount)
      .storeMaybeRef(undefined)
      .endCell();

    return beginCell().storeUint(Op.mint, 32).storeUint(query_id, 64) // op, queryId
      .storeAddress(to)
      .storeCoins(total_ton_amount)
      .storeCoins(jetton_amount)
      .storeRef(mintMsg)
      .endCell();
  }

  async sendMint(
    provider: ContractProvider,
    via: Sender,
    to: Address,
    jetton_amount: bigint,
    forward_ton_amount: bigint,
    total_ton_amount: bigint,
  ) {
    if (total_ton_amount <= forward_ton_amount) {
      throw new Error('Total ton amount should be > forward amount');
    }
    await provider.internal(via, {
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: JettonMinter.mintMessage(this.address, to, jetton_amount, forward_ton_amount, total_ton_amount),
      value: total_ton_amount + toNano('0.015'),
    });
  }

  /* provide_wallet_address#2c76b973 query_id:uint64 owner_address:MsgAddress include_address:Bool = InternalMsgBody;
  */
  static discoveryMessage(owner: Address, include_address: boolean) {
    return beginCell().storeUint(0x2c76b973, 32).storeUint(0, 64) // op, queryId
      .storeAddress(owner)
      .storeBit(include_address)
      .endCell();
  }

  async sendDiscovery(
    provider: ContractProvider,
    via: Sender,
    owner: Address,
    include_address: boolean,
    value: bigint = toNano('0.1'),
  ) {
    await provider.internal(via, {
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: JettonMinter.discoveryMessage(owner, include_address),
      value,
    });
  }

  static changeAdminMessage(newOwner: Address) {
    return beginCell().storeUint(Op.change_admin, 32).storeUint(0, 64) // op, queryId
      .storeAddress(newOwner)
      .endCell();
  }

  async sendChangeAdmin(provider: ContractProvider, via: Sender, newOwner: Address) {
    await provider.internal(via, {
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: JettonMinter.changeAdminMessage(newOwner),
      value: toNano('0.05'),
    });
  }

  static changeContentMessage(content: Cell) {
    return beginCell().storeUint(Op.change_content, 32).storeUint(0, 64) // op, queryId
      .storeRef(content)
      .endCell();
  }

  async sendChangeContent(provider: ContractProvider, via: Sender, content: Cell) {
    await provider.internal(via, {
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: JettonMinter.changeContentMessage(content),
      value: toNano('0.05'),
    });
  }

  async getWalletAddress(provider: ContractProvider, owner: Address): Promise<Address> {
    const res = await provider.get('get_wallet_address', [{
      type: 'slice', cell: beginCell().storeAddress(owner).endCell(),
    }]);
    return res.stack.readAddress();
  }

  async getJettonData(provider: ContractProvider) {
    const res = await provider.get('get_jetton_data', []);
    const totalSupply = res.stack.readBigNumber();
    const mintable = res.stack.readBoolean();
    const adminAddress = res.stack.readCellOpt();
    const content = res.stack.readCell();
    const walletCode = res.stack.readCell();
    return {
      totalSupply,
      mintable,
      adminAddress,
      content,
      walletCode,
    };
  }

  async getTotalSupply(provider: ContractProvider) {
    const res = await this.getJettonData(provider);
    return res.totalSupply;
  }

  async getAdminAddress(provider: ContractProvider) {
    const res = await this.getJettonData(provider);
    return res.adminAddress;
  }

  async getContent(provider: ContractProvider) {
    const res = await this.getJettonData(provider);
    return res.content;
  }
}
