import type {
  Address, Cell, Contract, ContractProvider, DictionaryValue,
} from '@ton/core';
import { beginCell, contractAddress, Dictionary } from '@ton/core';

import type { StakingPoolConfig } from './StakingPool';

import { readCellOpt } from '../util';
import { Dividers } from './imports/constants';

export type UserRewardsDictValue = {
  distributedRewards: bigint;
  unclaimedRewards: bigint;
};

export type StakeWalletConfig = {
  stakingPoolAddress: Address;
  ownerAddress: Address;
  minterAddress: Address;
  lockPeriod: bigint;
  jettonBalance: bigint;
  rewardsDict: Dictionary<Address, UserRewardsDictValue>;
  unstakeRequests: Dictionary<number, bigint>;
  requestsCount: bigint;
  totalRequestedJettons: bigint;
  isActive: boolean;
  unstakeCommission: bigint;
  unstakeFee: bigint;
  minDeposit: bigint;
  maxDeposit: bigint;
  whitelist: Dictionary<Address, boolean>;
};

export type StakeWalletUninitedConfig = {
  stakingPoolAddress: Address;
  ownerAddress: Address;
  minterAddress: Address;
  lockPeriod: bigint;
};

export function userRewardsDictValueParser(): DictionaryValue<UserRewardsDictValue> {
  return {
    serialize: (src, buidler) => {
      buidler.storeUint(src.distributedRewards, 256).storeCoins(src.unclaimedRewards).endCell();
    },
    parse: (src) => {
      return { distributedRewards: src.loadUintBig(256), unclaimedRewards: src.loadCoins() };
    },
  };
}

export function stakeWalletConfigToCell(config: StakeWalletUninitedConfig | StakeWalletConfig): Cell {
  return beginCell()
    .storeAddress(config.stakingPoolAddress)
    .storeAddress(config.minterAddress)
    .storeAddress(config.ownerAddress)
    .storeRef(
      beginCell()
        .storeUint(config.lockPeriod, 32)
        .storeUint(1, 19)
        .endCell(),
    )
    .endCell();
}

export class StakeWallet implements Contract {
  constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

  static createFromAddress(address: Address) {
    return new StakeWallet(address);
  }

  static createFromConfig(config: StakeWalletUninitedConfig | StakeWalletConfig, code: Cell, workchain = 0) {
    const data = stakeWalletConfigToCell(config);
    const init = { code, data };
    return new StakeWallet(contractAddress(workchain, init), init);
  }

  static getAvailableRewards(stakeWalletConfig: StakeWalletConfig, poolConfig: StakingPoolConfig) {
    if (!poolConfig.rewardJettons) {
      return {};
    }

    const timeNow = Math.floor(Date.now() / 1000);
    const rewardMultiplier = poolConfig.lockPeriods.get(Number(stakeWalletConfig.lockPeriod))!.rewardMultiplier;

    const res: Record<string, bigint> = {};
    for (const rewardJettonWallet of poolConfig.rewardJettons.keys()) {
      const poolRewardsInfo = poolConfig.rewardJettons.get(rewardJettonWallet)!;
      const userRewardsInfo = stakeWalletConfig.rewardsDict.get(rewardJettonWallet);
      let unclaimedRewards = userRewardsInfo ? userRewardsInfo.unclaimedRewards : 0n;
      const userDistributedRewards = userRewardsInfo ? userRewardsInfo.distributedRewards : 0n;
      let poolDistributedRewards = poolRewardsInfo.distributedRewards;
      for (const i of poolRewardsInfo.rewardsDeposits.keys()) {
        const rewardDeposit = poolRewardsInfo.rewardsDeposits.get(i)!;
        if (rewardDeposit.startTime < timeNow && poolConfig.tvlWithMultipliers) {
          poolDistributedRewards += (
            rewardDeposit.distributionSpeed
            * BigInt(Math.min(timeNow, rewardDeposit.endTime) - rewardDeposit.startTime)
            * Dividers.DISTRIBUTED_REWARDS_DIVIDER
          ) / (Dividers.DISTRIBUTION_SPEED_DIVIDER * poolConfig.tvlWithMultipliers);
        }
      }
      unclaimedRewards += (
        (poolDistributedRewards - userDistributedRewards)
        * stakeWalletConfig.jettonBalance
        * BigInt(rewardMultiplier)
      ) / (Dividers.DISTRIBUTED_REWARDS_DIVIDER * BigInt(Dividers.REWARDS_DIVIDER));
      res[rewardJettonWallet.toString()] = unclaimedRewards;
    }
    return res;
  }

  async getStorageData(provider: ContractProvider): Promise<StakeWalletConfig> {
    const { stack } = await provider.get('get_storage_data', []);

    const res: any = {
      stakingPoolAddress: stack.readAddress(),
      ownerAddress: stack.readAddress(),
      lockPeriod: stack.readBigNumber(),
      jettonBalance: stack.readBigNumber(),
      rewardsDict: readCellOpt(stack),
      unstakeRequests: readCellOpt(stack),
      requestsCount: stack.readBigNumber(),
      totalRequestedJettons: stack.readBigNumber(),
      isActive: Boolean(stack.readNumber()),
      unstakeCommission: stack.readBigNumber(),
      unstakeFee: stack.readBigNumber(),
      minDeposit: stack.readBigNumber(),
      maxDeposit: stack.readBigNumber(),
      whitelist: readCellOpt(stack),
      minterAddress: stack.readAddress(),
    };

    if (res.rewardsDict) {
      res.rewardsDict = res.rewardsDict.beginParse()
        .loadDictDirect(Dictionary.Keys.Address(), userRewardsDictValueParser());
    }
    if (res.unstakeRequests) {
      res.unstakeRequests = res.unstakeRequests.beginParse()
        .loadDictDirect(Dictionary.Keys.Uint(32), Dictionary.Values.BigVarUint(4));
    }
    if (res.whitelist) {
      res.whitelist = res.whitelist.beginParse()
        .loadDictDirect(Dictionary.Keys.Address(), Dictionary.Values.Bool());
    }

    return res as StakeWalletConfig;
  }
}
