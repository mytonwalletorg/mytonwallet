import { useEffect } from '../lib/teact/teact';

import { IS_TELEGRAM_APP } from '../config';
import { createSignal } from '../util/signals';
import { getTelegramAppAsync } from '../util/telegram';
import useLastCallback from './useLastCallback';

const [getIsInBackgroundLocal, setIsInBackground] = createSignal(!document.hasFocus());
export const getIsInBackground = getIsInBackgroundLocal;

function handleBlur() {
  setIsInBackground(true);
}

function handleFocus() {
  setIsInBackground(false);
}

if (IS_TELEGRAM_APP) {
  void getTelegramAppAsync().then((telegramApp) => {
    telegramApp!.onEvent('activated', handleFocus);
    telegramApp!.onEvent('deactivated', handleBlur);
    setIsInBackground(!telegramApp?.isActive);
  });
} else {
  window.addEventListener('blur', handleBlur);
  window.addEventListener('focus', handleFocus);
}

export default function useBackgroundMode(
  onBlur?: AnyToVoidFunction,
  onFocus?: AnyToVoidFunction,
  isDisabled = false,
) {
  const lastOnBlur = useLastCallback(onBlur);
  const lastOnFocus = useLastCallback(onFocus);

  useEffect(() => {
    if (isDisabled) {
      return undefined;
    }

    if (getIsInBackground()) {
      lastOnBlur();
    }

    return getIsInBackground.subscribe(() => {
      if (getIsInBackground()) {
        lastOnBlur();
      } else {
        lastOnFocus();
      }
    });
  }, [isDisabled, lastOnBlur, lastOnFocus]);
}

export function isBackgroundModeActive() {
  return getIsInBackground();
}
