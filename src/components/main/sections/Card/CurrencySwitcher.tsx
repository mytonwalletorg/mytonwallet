import React, { memo, useMemo } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ApiBaseCurrency } from '../../../../api/types';

import { CURRENCY_LIST } from '../../../../config';

import useLastCallback from '../../../../hooks/useLastCallback';

import DropdownMenu from '../../../ui/DropdownMenu';

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

function CurrencySwitcher({
  isOpen,
  currentCurrency,
  excludedCurrency,
  menuPositionX,
  onClose,
  onChange,
}: OwnProps & StateProps) {
  const { changeBaseCurrency } = getActions();

  const currencyList = useMemo(
    () => CURRENCY_LIST.filter((item) => item.value !== excludedCurrency),
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
      onClose={onClose}
      items={currencyList}
      shouldTranslateOptions
      selectedValue={currentCurrency}
      menuPositionX={menuPositionX}
      onSelect={handleBaseCurrencyChange}
    />
  );
}

export default memo(withGlobal<OwnProps>((global) => {
  return {
    currentCurrency: global.settings.baseCurrency,
  };
})(CurrencySwitcher));
