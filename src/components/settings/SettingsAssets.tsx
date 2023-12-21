import React, { memo, useRef, useState } from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { ApiBaseCurrency } from '../../api/types';
import type { UserToken } from '../../global/types';

import {
  DEFAULT_PRICE_CURRENCY,
  TINY_TRANSFER_MAX_COST, TON_SYMBOL,
} from '../../config';
import buildClassName from '../../util/buildClassName';

import useHistoryBack from '../../hooks/useHistoryBack';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useScrolledState from '../../hooks/useScrolledState';

import Button from '../ui/Button';
import Dropdown from '../ui/Dropdown';
import IconWithTooltip from '../ui/IconWithTooltip';
import ModalHeader from '../ui/ModalHeader';
import Switcher from '../ui/Switcher';
import SettingsTokens from './SettingsTokens';

import styles from './Settings.module.scss';

interface OwnProps {
  isActive?: boolean;
  tokens?: UserToken[];
  orderedSlugs?: string[];
  areTinyTransfersHidden?: boolean;
  isInvestorViewEnabled?: boolean;
  areTokensWithNoBalanceHidden?: boolean;
  areTokensWithNoPriceHidden?: boolean;
  isSortByValueEnabled?: boolean;
  isInsideModal?: boolean;
  handleBackClick: NoneToVoidFunction;
  baseCurrency?: ApiBaseCurrency;
}

const CURRENCY_OPTIONS = [
  {
    value: 'USD',
    name: 'US Dollar',
  },
  {
    value: 'EUR',
    name: 'Euro',
  },
  {
    value: 'RUB',
    name: 'Ruble',
  },
  {
    value: 'CNY',
    name: 'Yuan',
  },
  {
    value: 'BTC',
    name: 'Bitcoin',
  },
  {
    value: 'TON',
    name: 'Toncoin',
  },
];

function SettingsAssets({
  isActive,
  tokens,
  orderedSlugs,
  areTinyTransfersHidden,
  isInvestorViewEnabled,
  areTokensWithNoBalanceHidden,
  areTokensWithNoPriceHidden,
  isSortByValueEnabled,
  handleBackClick,
  isInsideModal,
  baseCurrency,
}: OwnProps) {
  const {
    toggleTinyTransfersHidden,
    toggleInvestorView,
    toggleTokensWithNoBalance,
    toggleTokensWithNoPrice,
    toggleSortByValue,
    changeBaseCurrency,
  } = getActions();
  const lang = useLang();

  // eslint-disable-next-line no-null/no-null
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useHistoryBack({
    isActive,
    onBack: handleBackClick,
  });

  const {
    handleScroll: handleContentScroll,
    isScrolled,
  } = useScrolledState();

  const handleTinyTransfersHiddenToggle = useLastCallback(() => {
    toggleTinyTransfersHidden({ isEnabled: !areTinyTransfersHidden });
  });

  const handleInvestorViewToggle = useLastCallback(() => {
    toggleInvestorView({ isEnabled: !isInvestorViewEnabled });
  });

  const handleTokensWithNoBalanceToggle = useLastCallback(() => {
    toggleTokensWithNoBalance({ isEnabled: !areTokensWithNoBalanceHidden });
  });

  const handleTokensWithNoPriceToggle = useLastCallback(() => {
    toggleTokensWithNoPrice({ isEnabled: !areTokensWithNoPriceHidden });
  });

  const handleSortByValueToggle = useLastCallback(() => {
    toggleSortByValue({ isEnabled: !isSortByValueEnabled });
  });

  const [localBaseCurrency, setLocalBaseCurrency] = useState(baseCurrency);

  const handleBaseCurrencyChange = useLastCallback((currency: string) => {
    if (currency !== baseCurrency) {
      setLocalBaseCurrency(currency as ApiBaseCurrency);
      changeBaseCurrency({ currency: currency as ApiBaseCurrency });
    }
  });

  return (
    <div className={styles.slide}>
      {isInsideModal ? (
        <ModalHeader
          title={lang('Assets & Activity')}
          withNotch={isScrolled}
          onBackButtonClick={handleBackClick}
          className={styles.modalHeader}
        />
      ) : (
        <div className={buildClassName(styles.header, 'with-notch-on-scroll', isScrolled && 'is-scrolled')}>
          <Button isSimple isText onClick={handleBackClick} className={styles.headerBack}>
            <i className={buildClassName(styles.iconChevron, 'icon-chevron-left')} aria-hidden />
            <span>{lang('Back')}</span>
          </Button>
          <span className={styles.headerTitle}>{lang('Assets & Activity')}</span>
        </div>
      )}
      <div
        className={buildClassName(styles.content, 'custom-scroll')}
        onScroll={handleContentScroll}
        ref={scrollContainerRef}
      >
        <div className={styles.settingsBlock}>
          <Dropdown
            label={lang('Base Currency')}
            items={CURRENCY_OPTIONS}
            selectedValue={baseCurrency ?? DEFAULT_PRICE_CURRENCY}
            theme="light"
            shouldTranslateOptions
            className={buildClassName(styles.item, styles.item_small)}
            onChange={handleBaseCurrencyChange}
            isLoading={localBaseCurrency !== baseCurrency}
          />
          <div className={buildClassName(styles.item, styles.item_small)} onClick={handleInvestorViewToggle}>
            <div className={styles.blockWithTooltip}>
              {lang('Investor View')}

              <IconWithTooltip
                message={lang('Focus on asset value rather than current balance')}
                tooltipClassName={styles.tooltip}
                iconClassName={styles.iconQuestion}
              />

            </div>

            <Switcher
              className={styles.menuSwitcher}
              label={lang('Investor View')}
              checked={isInvestorViewEnabled}
            />
          </div>
          <div className={buildClassName(styles.item, styles.item_small)} onClick={handleTinyTransfersHiddenToggle}>
            <div className={styles.blockWithTooltip}>
              {lang('Hide Tiny Transfers')}

              <IconWithTooltip
                message={
                  lang(
                    '$tiny_transfers_help',
                    [TINY_TRANSFER_MAX_COST, TON_SYMBOL],
                  ) as string
                }
                tooltipClassName={buildClassName(styles.tooltip, styles.tooltip_wide)}
                iconClassName={styles.iconQuestion}
              />
            </div>

            <Switcher
              className={styles.menuSwitcher}
              label={lang('Hide Tiny Transfers')}
              checked={areTinyTransfersHidden}
            />
          </div>
        </div>
        <p className={styles.blockTitle}>{lang('Tokens Settings')}</p>
        <div className={styles.settingsBlock}>
          <div className={buildClassName(styles.item, styles.item_small)} onClick={handleTokensWithNoBalanceToggle}>
            {lang('Hide Tokens With No Balance')}

            <Switcher
              className={styles.menuSwitcher}
              label={lang('Hide Tokens With No Balance')}
              checked={areTokensWithNoBalanceHidden}
            />
          </div>
          <div className={buildClassName(styles.item, styles.item_small)} onClick={handleTokensWithNoPriceToggle}>
            {lang('Hide Tokens With No Price')}

            <Switcher
              className={styles.menuSwitcher}
              label={lang('Hide Tokens With No Price')}
              checked={areTokensWithNoPriceHidden}
            />
          </div>
          <div className={buildClassName(styles.item, styles.item_small)} onClick={handleSortByValueToggle}>
            {lang('Sort By Value')}

            <Switcher
              className={styles.menuSwitcher}
              label={lang('Sort By Value')}
              checked={isSortByValueEnabled}
            />
          </div>
        </div>

        <SettingsTokens
          parentContainer={scrollContainerRef}
          tokens={tokens}
          orderedSlugs={orderedSlugs}
          isSortByValueEnabled={isSortByValueEnabled}
          baseCurrency={baseCurrency}
        />
      </div>
    </div>
  );
}

export default memo(SettingsAssets);
