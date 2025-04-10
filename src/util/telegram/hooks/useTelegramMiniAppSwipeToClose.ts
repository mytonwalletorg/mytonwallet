import { useEffect, useRef } from '../../../lib/teact/teact';

import { IS_IOS } from '../../windowEnvironment';
import { disableTelegramMiniAppSwipeToClose, enableTelegramMiniAppSwipeToClose } from '../index';

import useLastCallback from '../../../hooks/useLastCallback';

export default function useTelegramMiniAppSwipeToClose(isActive?: boolean) {
  const isSwipeDisabledRef = useRef(false);

  useEffect(() => {
    if (!IS_IOS) return;

    if (!isActive && isSwipeDisabledRef.current) {
      enableTelegramMiniAppSwipeToClose();
      isSwipeDisabledRef.current = false;
    }
  }, [isActive]);

  const disableSwipeToClose = useLastCallback(() => {
    if (IS_IOS && !isSwipeDisabledRef.current) {
      disableTelegramMiniAppSwipeToClose();
      isSwipeDisabledRef.current = true;
    }
  });

  const enableSwipeToClose = useLastCallback(() => {
    if (IS_IOS && isSwipeDisabledRef.current) {
      enableTelegramMiniAppSwipeToClose();
      isSwipeDisabledRef.current = false;
    }
  });

  return {
    disableSwipeToClose,
    enableSwipeToClose,
  };
}
