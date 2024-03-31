import React, { memo, useMemo } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { TokenPeriod } from '../../../../global/types';

import { HISTORY_PERIODS } from '../../../../config';
import { selectCurrentAccountState } from '../../../../global/selectors';

import useLastCallback from '../../../../hooks/useLastCallback';

import DropdownMenu from '../../../ui/DropdownMenu';

import styles from './ChartHistorySwitcher.module.scss';

interface OwnProps {
  isOpen: boolean;
  isTon: boolean;
  onClose: NoneToVoidFunction;
  onChange?: (period: TokenPeriod) => void;
}

interface StateProps {
  currentPeriod?: TokenPeriod;
}

const ITEMS = HISTORY_PERIODS.map((key) => ({ value: key, name: key === 'ALL' ? 'All' : key }));

function ChartHistorySwitcher({
  isOpen,
  isTon,
  currentPeriod,
  onClose,
  onChange,
}: OwnProps & StateProps) {
  const { setCurrentTokenPeriod } = getActions();

  const RENDERED_ITEMS = useMemo(() => {
    // The `ALL` range is only available for TON
    return ITEMS.map(({ value, name }) => ({ value, name, isDisabled: value === 'ALL' && !isTon }));
  }, [isTon]);

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
      items={RENDERED_ITEMS}
      className={styles.menuWrapper}
      bubbleClassName={styles.menu}
      buttonClassName={styles.menuItem}
      selectedValue={currentPeriod}
      menuPositionHorizontal="right"
      onSelect={handlePeriodChange}
    />
  );
}

export default memo(withGlobal<OwnProps>((global): StateProps => {
  const accountState = selectCurrentAccountState(global);

  return {
    currentPeriod: accountState?.currentTokenPeriod,
  };
})(ChartHistorySwitcher));
