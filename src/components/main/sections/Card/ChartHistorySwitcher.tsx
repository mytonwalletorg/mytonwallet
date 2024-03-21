import React, { memo } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { TokenPeriod } from '../../../../global/types';

import { HISTORY_PERIODS } from '../../../../config';

import useLastCallback from '../../../../hooks/useLastCallback';

import DropdownMenu from '../../../ui/DropdownMenu';

interface OwnProps {
  isOpen: boolean;
  onClose: NoneToVoidFunction;
  onChange?: (period: TokenPeriod) => void;
}

interface StateProps {
  currentPeriod?: TokenPeriod;
}

const ITEMS = HISTORY_PERIODS.map((key) => ({ value: key, name: key }));

function ChartHistorySwitcher({
  isOpen,
  currentPeriod,
  onClose,
  onChange,
}: OwnProps & StateProps) {
  const { setCurrentTokenPeriod } = getActions();

  const handlePeriodChange = useLastCallback((period: string) => {
    onClose();

    if (period === currentPeriod) return;

    setCurrentTokenPeriod({ period: period as TokenPeriod });
    onChange?.(period as TokenPeriod);
  });

  return (
    <DropdownMenu
      isOpen={isOpen}
      onClose={onClose}
      items={ITEMS}
      shouldTranslateOptions
      selectedValue={currentPeriod}
      menuPositionHorizontal="right"
      onSelect={handlePeriodChange}
    />
  );
}

export default memo(withGlobal<OwnProps>((global) => {
  return {
    currentCurrency: global.settings.baseCurrency,
  };
})(ChartHistorySwitcher));
