import { useEffect } from '../lib/teact/teact';

import { IS_TELEGRAM_APP } from '../config';
import { createCallbackManager } from '../util/callbacks';
import { getTelegramAppAsync } from '../util/telegram';
import useLastCallback from './useLastCallback';

const blurCallbacks = createCallbackManager();
const focusCallbacks = createCallbackManager();

let isFocused = document.hasFocus();

function handleBlur() {
  if (!isFocused) return;

  isFocused = false;
  blurCallbacks.runCallbacks();
}

function handleFocus() {
  isFocused = true;
  focusCallbacks.runCallbacks();
}

if (IS_TELEGRAM_APP) {
  void getTelegramAppAsync().then((telegramApp) => {
    telegramApp!.onEvent('activated', handleFocus);
    telegramApp!.onEvent('deactivated', handleBlur);
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

    if (!isFocused) {
      lastOnBlur();
    }

    blurCallbacks.addCallback(lastOnBlur);
    focusCallbacks.addCallback(lastOnFocus);

    return () => {
      focusCallbacks.removeCallback(lastOnFocus);
      blurCallbacks.removeCallback(lastOnBlur);
    };
  }, [isDisabled, lastOnBlur, lastOnFocus]);
}

export function isBackgroundModeActive() {
  return !isFocused;
}
