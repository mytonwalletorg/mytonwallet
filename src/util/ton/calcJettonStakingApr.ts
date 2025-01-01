import { DAYS_IN_YEAR } from '../../api/constants';
import { toBig } from '../decimals';

export default function calcJettonStakingApr({
  tvl, dailyReward, decimals,
}: {
  tvl: bigint;
  dailyReward: bigint;
  decimals: number;
}) {
  if (!tvl) {
    return 0;
  }

  const apr = toBig(dailyReward, decimals)
    .div(toBig(tvl, decimals))
    .mul(DAYS_IN_YEAR)
    .mul(100)
    .toFixed(2);

  return Number(apr);
}
