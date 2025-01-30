import { useEffect } from '../lib/teact/teact';

import { hideBottomBar, showBottomBar } from '../components/main/sections/Actions/BottomBar';

// Use this hook when you need to temporarily hide the bottom bar on a screen, for example,
// when assumes the use of the entire screen height - `PasswordForm` with biometrics
export default function useHideBottomBar(isHidden: boolean) {
  useEffect(() => {
    if (!isHidden) return undefined;

    hideBottomBar();

    return showBottomBar;
  }, [isHidden]);
}
