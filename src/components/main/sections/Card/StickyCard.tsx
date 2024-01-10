import React, { memo, useMemo } from '../../../../lib/teact/teact';
import { withGlobal } from '../../../../global';

import type { ApiBaseCurrency } from '../../../../api/types';
import type { UserToken } from '../../../../global/types';

import { selectCurrentAccountState, selectCurrentAccountTokens } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { getShortCurrencySymbol } from '../../../../util/formatNumber';
import { IS_ELECTRON, IS_MAC_OS, IS_WINDOWS } from '../../../../util/windowEnvironment';
import { calculateFullBalance } from './helpers/calculateFullBalance';

import AccountSelector from './AccountSelector';

import styles from './StickyCard.module.scss';

interface OwnProps {
  classNames?: string;
  onQrScanPress?: NoneToVoidFunction;
}

interface StateProps {
  tokens?: UserToken[];
  baseCurrency?: ApiBaseCurrency;
  stakingBalance?: number;
}

function StickyCard({
  classNames,
  tokens,
  onQrScanPress,
  baseCurrency,
  stakingBalance,
}: OwnProps & StateProps) {
  const values = useMemo(() => {
    return tokens ? calculateFullBalance(tokens, stakingBalance) : undefined;
  }, [tokens, stakingBalance]);

  const shortBaseSymbol = getShortCurrencySymbol(baseCurrency);
  const { primaryWholePart, primaryFractionPart } = values || {};

  return (
    <div className={styles.root}>
      <div className={buildClassName(styles.background, classNames)}>
        <div className={styles.content}>
          <AccountSelector
            accountClassName={styles.account}
            accountSelectorClassName="sticky-card-account-selector"
            menuButtonClassName={styles.menuButton}
            noSettingsButton={(IS_ELECTRON && IS_WINDOWS) || Boolean(onQrScanPress)}
            noAccountSelector={IS_ELECTRON && IS_MAC_OS}
            onQrScanPress={onQrScanPress}
          />
          <div className={styles.balance}>
            {shortBaseSymbol.length === 1 && shortBaseSymbol}
            {primaryWholePart}
            {primaryFractionPart && <span className={styles.balanceFractionPart}>.{primaryFractionPart}</span>}
            {shortBaseSymbol.length > 1 && <span className={styles.balanceFractionPart}>&nbsp;{shortBaseSymbol}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(
  withGlobal<OwnProps>(
    (global): StateProps => {
      const accountState = selectCurrentAccountState(global);
      return {
        tokens: selectCurrentAccountTokens(global),
        baseCurrency: global.settings.baseCurrency,
        stakingBalance: accountState?.staking?.balance,
      };
    },
    (global, _, stickToFirst) => stickToFirst(global.currentAccountId),
  )(StickyCard),
);
