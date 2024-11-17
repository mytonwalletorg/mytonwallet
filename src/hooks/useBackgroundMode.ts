import { useEffect } from '../lib/teact/teact';

import { createCallbackManager } from '../util/callbacks';
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

window.addEventListener('blur', handleBlur);
window.addEventListener('focus', handleFocus);

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
