import React, { memo, useMemo } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ApiBaseCurrency } from '../../../../api/types';
import type { DropdownItem } from '../../../ui/Dropdown';

import { CURRENCIES } from '../../../../config';

import useLastCallback from '../../../../hooks/useLastCallback';

import DropdownMenu from '../../../ui/DropdownMenu';

import styles from './Card.module.scss';

interface OwnProps {
  isOpen: boolean;
  excludedCurrency?: string;
  menuPositionX?: 'right' | 'left';
  onClose: NoneToVoidFunction;
  onChange?: (currency: ApiBaseCurrency) => void;
}

interface StateProps {
  currentCurrency?: ApiBaseCurrency;
}

function CurrencySwitcherMenu({
  isOpen,
  currentCurrency,
  excludedCurrency,
  menuPositionX,
  onClose,
  onChange,
}: OwnProps & StateProps) {
  const { changeBaseCurrency } = getActions();

  const currencyList = useMemo<DropdownItem<ApiBaseCurrency>[]>(
    () => Object.entries(CURRENCIES)
      .filter(([currency]) => currency !== excludedCurrency)
      .map(([currency, { name }]) => ({ value: currency as keyof typeof CURRENCIES, name })),
    [excludedCurrency],
  );

  const handleBaseCurrencyChange = useLastCallback((currency: string) => {
    onClose();

    if (currency === currentCurrency) return;

    changeBaseCurrency({ currency: currency as ApiBaseCurrency });
    onChange?.(currency as ApiBaseCurrency);
  });

  return (
    <DropdownMenu
      isOpen={isOpen}
      items={currencyList}
      shouldTranslateOptions
      selectedValue={currentCurrency}
      menuPositionX={menuPositionX}
      className={styles.currencySwitcherMenu}
      onClose={onClose}
      onSelect={handleBaseCurrencyChange}
    />
  );
}

export default memo(withGlobal<OwnProps>((global) => {
  return {
    currentCurrency: global.settings.baseCurrency,
  };
})(CurrencySwitcherMenu));
