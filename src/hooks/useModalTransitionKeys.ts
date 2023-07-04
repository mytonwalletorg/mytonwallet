import { useEffect, useState } from '../lib/teact/teact';

import type { TransferState } from '../global/types';

import useCurrentOrPrev from './useCurrentOrPrev';
import useLastCallback from './useLastCallback';

const ANIMATION_DURATION = 300;

export default function useModalTransitionKeys(activeKey: number, isOpen: boolean) {
  // Use previous key during closing animation
  const renderingKey = useCurrentOrPrev(isOpen ? activeKey : undefined, true) ?? -1;
  const [nextKey, setNextKey] = useState<TransferState>();

  const updateNextKey = useLastCallback(() => {
    setNextKey(isOpen ? renderingKey + 1 : undefined);
  });

  // Set next key after modal is fully open
  useEffect(() => {
    if (isOpen) {
      setTimeout(updateNextKey, ANIMATION_DURATION);
    }
  }, [isOpen, updateNextKey]);

  return { renderingKey, nextKey, updateNextKey };
}
