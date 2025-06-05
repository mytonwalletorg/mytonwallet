import type {
  Address, Cell, Contract, ContractProvider, DictionaryValue,
} from '@ton/core';
import { beginCell, contractAddress, Dictionary } from '@ton/core';
import type { Maybe } from '@ton/core/dist/utils/maybe';

import type { AddrList } from './imports/constants';

import { readCellOpt } from '../util';
import { JettonStakingOpCodes } from './imports/constants';

export type LockPeriodsValue = {
  curTvl: bigint;
  tvlLimit: bigint;
  rewardMultiplier: number;
  depositCommission: number;
  unstakeCommission: number;
  minterAddress: Address;
};

function lockPeriodsValueParser(): DictionaryValue<LockPeriodsValue> {
  return {
    serialize: (src, buidler) => {
      buidler
        .storeCoins(src.curTvl)
        .storeCoins(src.tvlLimit)
        .storeUint(src.rewardMultiplier, 16)
        .storeUint(src.depositCommission, 16)
        .storeUint(src.unstakeCommission, 16)
        .storeAddress(src.minterAddress)
        .endCell();
    },
    parse: (src) => {
      return {
        curTvl: src.loadCoins(),
        tvlLimit: src.loadCoins(),
        rewardMultiplier: src.loadUint(16),
        depositCommission: src.loadUint(16),
        unstakeCommission: src.loadUint(16),
        minterAddress: src.loadAddress(),
      };
    },
  };
}

export type RewardsDepositsValue = {
  distributionSpeed: bigint;
  startTime: number;
  endTime: number;
};

function rewardsDepositsValueParser(): DictionaryValue<RewardsDepositsValue> {
  return {
    serialize: (src, buidler) => {
      buidler.storeCoins(src.distributionSpeed).storeUint(src.startTime, 32).storeUint(src.endTime, 32).endCell();
    },
    parse: (src) => {
      return { distributionSpeed: src.loadCoins(), startTime: src.loadUint(32), endTime: src.loadUint(32) };
    },
  };
}

export type RewardJettonsValue = {
  distributedRewards: bigint;
  rewardsDeposits: Dictionary<number, RewardsDepositsValue>;
};

function rewardJettonsValueParser(): DictionaryValue<RewardJettonsValue> {
  return {
    serialize: (src, buidler) => {
      buidler
        .storeUint(src.distributedRewards, 256)
        .storeDict(src.rewardsDeposits, Dictionary.Keys.Uint(32), rewardsDepositsValueParser())
        .endCell();
    },
    parse: (src) => {
      return {
        distributedRewards: src.loadUintBig(256),
        rewardsDeposits: src.loadDict(Dictionary.Keys.Uint(32), rewardsDepositsValueParser()),
      };
    },
  };
}

export type StakingPoolConfig = {
  inited: boolean;
  content?: Cell;
  poolId: bigint;
  factoryAddress: Address;
  adminAddress: Address;
  creatorAddress: Address;
  stakeWalletCode: Cell;
  lockWalletAddress: Address;
  minDeposit: bigint;
  maxDeposit: bigint;
  tvl: bigint;
  tvlWithMultipliers: bigint;
  rewardJettons: Dictionary<Address, RewardJettonsValue> | null;
  rewardJettonsCount?: bigint;
  rewardsDepositsCount?: bigint;
  lockPeriods: Dictionary<number, LockPeriodsValue>;
  whitelist: AddrList | null;
  unstakeFee: bigint;
  collectedCommissions: bigint;
  rewardsCommission: bigint;
  version?: bigint;
};

export type StakingPoolConfigUnpacked = Omit<StakingPoolConfig, 'rewardJettons' | 'lockPeriods'> & {
  rewardJettons: Record<string, {
    distributedRewards: bigint;
    rewardsDeposits: Record<number, RewardsDepositsValue>;
  }> | null;
  lockPeriods: Record<number, LockPeriodsValue>;
  whitelist: Record<string, boolean> | null;
};

export type StakingPoolUninitedConfig = {
  poolId: bigint;
  factoryAddress: Address;
};

export function stakingPoolConfigToCell(config: StakingPoolUninitedConfig | StakingPoolConfig): Cell {
  return beginCell().storeAddress(config.factoryAddress).storeUint(config.poolId, 32).endCell();
}

export function stakingPoolInitedData(config: StakingPoolConfig): Cell {
  return beginCell()
    .storeBit(config.inited)
    .storeUint(config.poolId, 32)
    .storeAddress(config.adminAddress)
    .storeAddress(config.creatorAddress)
    .storeAddress(config.lockWalletAddress)
    .storeMaybeRef(config.content)
    .storeRef(config.stakeWalletCode)
    .storeRef(
      beginCell()
        .storeCoins(config.tvl)
        .storeCoins(config.tvlWithMultipliers)
        .storeCoins(config.minDeposit)
        .storeCoins(config.maxDeposit)
        .storeDict(config.rewardJettons, Dictionary.Keys.Address(), rewardJettonsValueParser())
        .storeUint(config.rewardJettonsCount ?? 0, 8)
        .storeUint(config.rewardsDepositsCount ?? 0, 8)
        .storeDict(config.lockPeriods, Dictionary.Keys.Uint(32), lockPeriodsValueParser())
        .storeDict(config.whitelist, Dictionary.Keys.Address(), Dictionary.Values.Bool())
        .storeCoins(config.unstakeFee)
        .storeCoins(config.collectedCommissions)
        .storeUint(config.rewardsCommission, 16)
        .storeUint(config.version ?? 0, 16)
        .endCell(),
    )
    .endCell();
}

export class StakingPool implements Contract {
  constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

  static createFromAddress(address: Address) {
    return new StakingPool(address);
  }

  static createFromConfig(config: StakingPoolUninitedConfig | StakingPoolConfig, code: Cell, workchain = 0) {
    const data = stakingPoolConfigToCell(config);
    const init = { code, data };
    return new StakingPool(contractAddress(workchain, init), init);
  }

  static stakePayload(lockPeriod: number | bigint): Cell {
    return beginCell().storeUint(JettonStakingOpCodes.STAKE_JETTONS, 32).storeUint(lockPeriod, 32).endCell();
  }

  async getData(provider: ContractProvider) {
    const { stack } = await provider.get('get_nft_data', []);
    return {
      init: stack.readBoolean(),
      index: stack.readBigNumber(),
      collection: stack.readAddressOpt(),
      owner: stack.readAddressOpt(),
      content: stack.readCell(),
    };
  }

  async getStorageData(provider: ContractProvider): Promise<StakingPoolConfig> {
    const { stack } = await provider.get('get_storage_data', []);
    const res: any = {
      inited: stack.readBoolean(),
      poolId: stack.readBigNumber(),
      adminAddress: stack.readAddress(),
      creatorAddress: stack.readAddress(),
      stakeWalletCode: stack.readCell(),
      lockWalletAddress: stack.readAddress(),
      tvl: stack.readBigNumber(),
      tvlWithMultipliers: stack.readBigNumber(),
      minDeposit: stack.readBigNumber(),
      maxDeposit: stack.readBigNumber(),
      rewardJettons: readCellOpt(stack),
      rewardJettonsCount: stack.readBigNumber(),
      rewardsDepositsCount: stack.readBigNumber(),
      lockPeriods: stack.readCellOpt(),
      whitelist: readCellOpt(stack),
      unstakeFee: stack.readBigNumber(),
      collectedCommissions: stack.readBigNumber(),
      rewardsCommission: stack.readBigNumber(),
      version: stack.readBigNumber(),
    };

    if (res.rewardJettons) {
      res.rewardJettons = res.rewardJettons.beginParse()
        .loadDictDirect(Dictionary.Keys.Address(), rewardJettonsValueParser());
    }
    if (res.lockPeriods) {
      res.lockPeriods = res.lockPeriods.beginParse()
        .loadDictDirect(Dictionary.Keys.Uint(32), lockPeriodsValueParser());
    }
    if (res.whitelist) {
      res.whitelist = res.whitelist.beginParse()
        .loadDictDirect(Dictionary.Keys.Address(), Dictionary.Values.Bool());
    }
    return res as StakingPoolConfig;
  }

  async getWalletAddress(
    provider: ContractProvider,
    ownerAddress: Address,
    lockPeriod: number,
  ): Promise<Maybe<Address>> {
    const { stack } = await provider.get('get_stake_wallet_address', [
      { type: 'slice', cell: beginCell().storeAddress(ownerAddress).endCell() },
      { type: 'int', value: BigInt(lockPeriod) },
    ]);
    return stack.readAddressOpt();
  }
}
