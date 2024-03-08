import React, { memo, useMemo } from '../../../../lib/teact/teact';
import { withGlobal } from '../../../../global';

import type { ApiBaseCurrency } from '../../../../api/types';
import type { UserToken } from '../../../../global/types';

import { selectCurrentAccountState, selectCurrentAccountTokens } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { getShortCurrencySymbol } from '../../../../util/formatNumber';
import { IS_ELECTRON, IS_MAC_OS, IS_WINDOWS } from '../../../../util/windowEnvironment';
import { calculateFullBalance } from './helpers/calculateFullBalance';

import useFlag from '../../../../hooks/useFlag';

import AccountSelector from './AccountSelector';
import CurrencySwitcher from './CurrencySwitcher';

import styles from './StickyCard.module.scss';

interface OwnProps {
  classNames?: string;
}

interface StateProps {
  tokens?: UserToken[];
  baseCurrency?: ApiBaseCurrency;
  stakingBalance?: bigint;
}

function StickyCard({
  classNames,
  tokens,
  baseCurrency,
  stakingBalance,
}: OwnProps & StateProps) {
  const [isCurrencyMenuOpen, openCurrencyMenu, closeCurrencyMenu] = useFlag(false);
  const values = useMemo(() => {
    return tokens ? calculateFullBalance(tokens, stakingBalance) : undefined;
  }, [tokens, stakingBalance]);

  const shortBaseSymbol = getShortCurrencySymbol(baseCurrency);
  const { primaryWholePart, primaryFractionPart } = values || {};
  const iconCaretClassNames = buildClassName(
    'icon',
    'icon-caret-down',
    styles.iconCaret,
    primaryFractionPart && styles.iconCaretFraction,
  );

  return (
    <div className={styles.root}>
      <div className={buildClassName(styles.background, classNames)}>
        <div className={styles.content}>
          <AccountSelector
            isInsideSticky
            accountClassName={styles.account}
            accountSelectorClassName="sticky-card-account-selector"
            menuButtonClassName={styles.menuButton}
            noSettingsButton={(IS_ELECTRON && IS_WINDOWS)}
            noAccountSelector={IS_ELECTRON && IS_MAC_OS}
          />
          <div className={styles.balance}>
            <span className={styles.currencySwitcher} role="button" tabIndex={0} onClick={openCurrencyMenu}>
              {shortBaseSymbol.length === 1 && shortBaseSymbol}
              {primaryWholePart}
              {primaryFractionPart && <span className={styles.balanceFractionPart}>.{primaryFractionPart}</span>}
              {shortBaseSymbol.length > 1 && (
                <span className={styles.balanceFractionPart}>&nbsp;{shortBaseSymbol}</span>
              )}
              <i className={iconCaretClassNames} aria-hidden />
            </span>
            <CurrencySwitcher isOpen={isCurrencyMenuOpen} onClose={closeCurrencyMenu} />
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
