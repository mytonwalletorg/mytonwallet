import { useEffect } from '../lib/teact/teact';

import { createCallbackManager } from '../util/callbacks';

let bottomBarHideCounter = 0;
const bottomBarListeners = createCallbackManager();

export function getIsBottomBarHidden() {
  return bottomBarHideCounter > 0;
}

export function subscribeToBottomBarVisibility(callback: () => void) {
  return bottomBarListeners.addCallback(callback);
}

function notifyBottomBarListeners() {
  bottomBarListeners.runCallbacks();
}

function hideBottomBar() {
  const wasHidden = getIsBottomBarHidden();
  bottomBarHideCounter += 1;

  if (!wasHidden && getIsBottomBarHidden()) {
    notifyBottomBarListeners();
  }
}

function showBottomBar() {
  const wasHidden = getIsBottomBarHidden();
  bottomBarHideCounter = Math.max(0, bottomBarHideCounter - 1);

  if (wasHidden && !getIsBottomBarHidden()) {
    notifyBottomBarListeners();
  }
}

// Use this hook when you need to temporarily hide the bottom bar on a screen, for example,
// when assumes the use of the entire screen height - `PasswordForm` with biometrics
export default function useHideBottomBar(isHidden: boolean) {
  useEffect(() => {
    if (!isHidden) return undefined;

    hideBottomBar();

    return showBottomBar;
  }, [isHidden]);
}
