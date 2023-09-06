import React, { memo, useMemo } from '../../../../lib/teact/teact';

import type { UserToken } from '../../../../global/types';

import { DEFAULT_PRICE_CURRENCY } from '../../../../config';
import { withGlobal } from '../../../../global';
import { selectCurrentAccountTokens } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { buildTokenValues } from './helpers/buildTokenValues';

import AccountSelector from './AccountSelector';

import styles from './StickyCard.module.scss';

interface OwnProps {
  classNames?: string;
}

interface StateProps {
  tokens?: UserToken[];
}

function StickyCard({ classNames, tokens }: OwnProps & StateProps) {
  const values = useMemo(() => {
    return tokens ? buildTokenValues(tokens) : undefined;
  }, [tokens]);

  const { primaryWholePart, primaryFractionPart } = values || {};

  return (
    <div className={styles.root}>
      <div className={buildClassName(styles.background, classNames)}>
        <div className={styles.content}>
          <AccountSelector
            accountClassName={styles.account}
            menuButtonClassName={styles.menuButton}
          />
          <div className={styles.balance}>
            {DEFAULT_PRICE_CURRENCY}
            {primaryWholePart}
            {primaryFractionPart && <span className={styles.balanceFractionPart}>.{primaryFractionPart}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(withGlobal<OwnProps>((global, ownProps, detachWhenChanged): StateProps => {
  detachWhenChanged(global.currentAccountId);

  return {
    tokens: selectCurrentAccountTokens(global),
  };
})(StickyCard));
