import React, { memo, useMemo } from '../../../../lib/teact/teact';
import { withGlobal } from '../../../../global';

import type { ApiBaseCurrency } from '../../../../api/types';
import type { UserToken } from '../../../../global/types';

import { selectCurrentAccountTokens } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { getShortCurrencySymbol } from '../../../../util/formatNumber';
import { IS_ELECTRON, IS_MAC_OS } from '../../../../util/windowEnvironment';
import { buildTokenValues } from './helpers/buildTokenValues';

import AccountSelector from './AccountSelector';

import styles from './StickyCard.module.scss';

interface OwnProps {
  classNames?: string;
  onQrScanPress?: NoneToVoidFunction;
}

interface StateProps {
  tokens?: UserToken[];
  baseCurrency?: ApiBaseCurrency;
}

function StickyCard({
  classNames,
  tokens,
  onQrScanPress,
  baseCurrency,
}: OwnProps & StateProps) {
  const values = useMemo(() => {
    return tokens ? buildTokenValues(tokens) : undefined;
  }, [tokens]);

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
            noSettingsButton
            noAccountSelector={IS_ELECTRON && IS_MAC_OS}
            onQrScanPress={onQrScanPress}
          />
          <div className={styles.balance}>
            {shortBaseSymbol}
            {primaryWholePart}
            {primaryFractionPart && <span className={styles.balanceFractionPart}>.{primaryFractionPart}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(
  withGlobal<OwnProps>(
    (global): StateProps => {
      return {
        tokens: selectCurrentAccountTokens(global),
      };
    },
    (global, _, stickToFirst) => stickToFirst(global.currentAccountId),
  )(StickyCard),
);
