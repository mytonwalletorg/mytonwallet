import TonWeb from 'tonweb';

import { ContractOptions, ContractMethods } from 'tonweb/dist/types/contract/contract';
import { HttpProvider } from 'tonweb/dist/types/providers/http-provider';
import { bnToAddress } from '../util/tonweb';

// const { parseAddress } = require('tonweb/src/contract/token/nft/NftUtils');

const { fromNano } = TonWeb.utils;

interface NominatorPoolOptions {}

interface NominatorPoolMethods extends ContractMethods {
  getListNominators: () => Promise<any>;
  getPoolData: () => Promise<any>;
  getMaxPunishment: (a: number) => Promise<number>;
}

export class NominatorPool extends TonWeb.Contract<NominatorPoolOptions, NominatorPoolMethods> {
  constructor(provider: HttpProvider, options: ContractOptions) {
    options.wc = 0;
    super(provider, options);

    if (!options.address) throw new Error('required address');

    this.methods.getListNominators = this.getListNominators.bind(this);
    this.methods.getPoolData = this.getPoolData.bind(this);
    this.methods.getMaxPunishment = this.getMaxPunishment.bind(this);
  }

  async getListNominators(): Promise<{
    address: string;
    amount: string;
    pendingDepositAmount: string;
    withdrawRequested: boolean;
  }[]> {
    const myAddress = await this.getAddress();
    const result = await this.provider.call2(myAddress.toString(), 'list_nominators');
    return (result as any[]).map((item) => {
      return {
        address: bnToAddress(item[0]),
        amount: fromNano(item[1]),
        pendingDepositAmount: fromNano(item[2]),
        withdrawRequested: item[3].toNumber()!!,
      };
    });
  }

  async getPoolData() {
    const myAddress = await this.getAddress();
    const result = await this.provider.call2(myAddress.toString(), 'get_pool_data');

    return {
      state: result[0].toString(), // ds~load_uint(8), ;; state
      nominatorsCount: result[1].toNumber(), // ds~load_uint(16), ;; nominators_count
      stakeAmountSent: fromNano(result[2]), // ds~load_coins(), ;; stake_amount_sent
      validatorAmount: fromNano(result[3]), // ds~load_coins(), ;; validator_amount
      validatorAddress: bnToAddress(result[4]), // ds~load_uint(ADDR_SIZE()), ;; validator_address
      validatorRewardShare: Math.round(result[5].toNumber() / 100), // ds~load_uint(16), ;; validator_reward_share
      maxNominatorsCount: result[6].toNumber(), // ds~load_uint(16), ;; max_nominators_count
      minValidatorStake: fromNano(result[7]), // ds~load_coins(), ;; min_validator_stake
      minNominatorStake: fromNano(result[8]), // ds~load_coins() ;; min_nominator_stake
      nominators: result[9].toString(), // ds~load_dict(), ;; nominators
      withdrawRequests: result[10].toString(), // ds~load_dict(), ;; withdraw_requests
      stakeAt: result[11].toNumber(), // ds~load_uint(32), ;; stake_at
      // savedValidatorSetHash: result[12].toString(), // ds~load_uint(256), ;; saved_validator_set_hash
      validatorSetChangesCount: result[13].toNumber(), // ds~load_uint(8), ;; validator_set_changes_count
      validatorSetChangeTime: result[14].toNumber(), // ds~load_uint(32), ;; validator_set_change_time
      stakeHeldFor: result[15].toString(), // ds~load_uint(32), ;; stake_held_for
      configProposalVotings: result[16].toString(), // ds~load_dict() ;; config_proposal_votings
    };
  }

  async getMaxPunishment(stake: number) {
    const myAddress = await this.getAddress();
    return this.provider.call2(myAddress.toString(), 'get_max_punishment', [['num', stake.toString()]]);
  }
}
