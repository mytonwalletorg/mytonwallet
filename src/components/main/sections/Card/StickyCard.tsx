import React, { type ElementRef, memo, useMemo, useState } from '../../../../lib/teact/teact';
import { withGlobal } from '../../../../global';

import type { ApiBaseCurrency, ApiNft, ApiStakingState } from '../../../../api/types';
import type { UserToken } from '../../../../global/types';

import { IS_CORE_WALLET } from '../../../../config';
import {
  selectAccountStakingStates,
  selectCurrentAccountSettings,
  selectCurrentAccountTokens,
} from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { getShortCurrencySymbol } from '../../../../util/formatNumber';
import { IS_ELECTRON, IS_MAC_OS } from '../../../../util/windowEnvironment';
import { calculateFullBalance } from './helpers/calculateFullBalance';
import getSensitiveDataMaskSkinFromCardNft from './helpers/getSensitiveDataMaskSkinFromCardNft';

import useFlag from '../../../../hooks/useFlag';
import useLastCallback from '../../../../hooks/useLastCallback';

import SensitiveData from '../../../ui/SensitiveData';
import AccountSelector from './AccountSelector';
import CurrencySwitcher from './CurrencySwitcher';
import CustomCardManager from './CustomCardManager';

import styles from './StickyCard.module.scss';

interface OwnProps {
  ref?: ElementRef<HTMLDivElement>;
  classNames?: string;
}

interface StateProps {
  tokens?: UserToken[];
  baseCurrency?: ApiBaseCurrency;
  stakingStates?: ApiStakingState[];
  cardNft?: ApiNft;
  isSensitiveDataHidden?: true;
}

function StickyCard({
  ref,
  classNames,
  tokens,
  baseCurrency,
  stakingStates,
  cardNft,
  isSensitiveDataHidden,
}: OwnProps & StateProps) {
  const [customCardClassName, setCustomCardClassName] = useState<string | undefined>(undefined);
  const [withTextGradient, setWithTextGradient] = useState<boolean>(false);
  const [isCurrencyMenuOpen, openCurrencyMenu, closeCurrencyMenu] = useFlag(false);

  const values = useMemo(() => {
    return tokens ? calculateFullBalance(tokens, stakingStates) : undefined;
  }, [tokens, stakingStates]);

  const handleCardChange = useLastCallback((hasGradient: boolean, className?: string) => {
    setCustomCardClassName(className);
    setWithTextGradient(hasGradient);
  });

  const sensitiveDataMaskSkin = getSensitiveDataMaskSkinFromCardNft(cardNft);
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
      <div ref={ref} className={buildClassName(styles.background, cardNft && styles.noNoise, classNames)}>
        {!IS_CORE_WALLET && (<CustomCardManager isSticky nft={cardNft} onCardChange={handleCardChange} />)}
        <div className={buildClassName(styles.content, customCardClassName)}>
          <AccountSelector
            isInsideSticky
            accountClassName={buildClassName(styles.account, withTextGradient && 'gradientText')}
            accountSelectorClassName="sticky-card-account-selector"
            menuButtonClassName={styles.menuButton}
            noSettingsButton
            withAccountSelector={!(IS_ELECTRON && IS_MAC_OS) && !IS_CORE_WALLET}
          />
          <div className={styles.balance}>
            <SensitiveData
              isActive={isSensitiveDataHidden}
              shouldHoldSize
              align="center"
              maskSkin={sensitiveDataMaskSkin}
              cols={10}
              rows={2}
              cellSize={9.5}
            >
              <span
                role="button"
                tabIndex={0}
                className={buildClassName(styles.currencySwitcher, withTextGradient && 'gradientText')}
                onClick={openCurrencyMenu}
              >
                {shortBaseSymbol.length === 1 && shortBaseSymbol}
                {primaryWholePart}
                {primaryFractionPart && <span className={styles.balanceFractionPart}>.{primaryFractionPart}</span>}
                {shortBaseSymbol.length > 1 && (
                  <span className={styles.balanceFractionPart}>&nbsp;{shortBaseSymbol}</span>
                )}
                <i className={iconCaretClassNames} aria-hidden />
              </span>
              <CurrencySwitcher isOpen={isCurrencyMenuOpen} onClose={closeCurrencyMenu} />
            </SensitiveData>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(
  withGlobal<OwnProps>(
    (global): StateProps => {
      const { cardBackgroundNft: cardNft } = selectCurrentAccountSettings(global) || {};
      const stakingStates = selectAccountStakingStates(global, global.currentAccountId!);

      return {
        tokens: selectCurrentAccountTokens(global),
        baseCurrency: global.settings.baseCurrency,
        cardNft,
        stakingStates,
        isSensitiveDataHidden: global.settings.isSensitiveDataHidden,
      };
    },
    (global, _, stickToFirst) => stickToFirst(global.currentAccountId),
  )(StickyCard),
);
