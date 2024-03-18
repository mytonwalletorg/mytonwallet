import React, { memo, useMemo } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { TokenPeriod } from '../../../../global/types';
import type { DropdownItem } from '../../../ui/Dropdown';

import useLastCallback from '../../../../hooks/useLastCallback';

import DropdownMenu from '../../../ui/DropdownMenu';

interface OwnProps {
  isOpen: boolean;
  excludedPeriod?: TokenPeriod;
  menuPositionHorizontal?: 'right' | 'left';
  onClose: NoneToVoidFunction;
}

interface StateProps {
  currentPeriod?: TokenPeriod;
}

const HISTORY_PERIODS: DropdownItem[] = [
  { value: '1D', name: '1D' },
  { value: '7D', name: '7D' },
  { value: '1M', name: '1M' },
  { value: '3M', name: '3M' },
  { value: '1Y', name: '1Y' },
];

function ChartHistorySwitcher({
  isOpen,
  currentPeriod,
  excludedPeriod,
  menuPositionHorizontal,
  onClose,
}: OwnProps & StateProps) {
  const { setCurrentTokenPeriod } = getActions();

  const historyList = useMemo(
    () => HISTORY_PERIODS.filter((item) => item.value !== excludedPeriod),
    [excludedPeriod],
  );

  const handlePeriodChange = useLastCallback((period: string) => {
    onClose();

    if (period === currentPeriod) return;

    setCurrentTokenPeriod({ period: period as TokenPeriod });
  });

  return (
    <DropdownMenu
      isOpen={isOpen}
      onClose={onClose}
      items={historyList}
      shouldTranslateOptions
      selectedValue={currentPeriod}
      menuPositionHorizontal={menuPositionHorizontal}
      onSelect={handlePeriodChange}
    />
  );
}

export default memo(withGlobal<OwnProps>((global) => {
  return {
    currentCurrency: global.settings.baseCurrency,
  };
})(ChartHistorySwitcher));
