import { BottomSheet } from 'native-bottom-sheet';

import { IS_CAPACITOR } from '../config';
import { IS_DELEGATED_BOTTOM_SHEET, IS_DELEGATING_BOTTOM_SHEET } from '../util/windowEnvironment';
import useLastCallback from './useLastCallback';
import useSyncEffect from './useSyncEffect';

import { getInAppBrowser } from '../components/ui/InAppBrowser';

let isBrowserHidden = false;

export default function useHideBrowser(isOpen?: boolean, isCompact?: boolean, onCloseAnimationEnd?: () => void) {
  useSyncEffect(() => {
    if (!IS_CAPACITOR || IS_DELEGATED_BOTTOM_SHEET || isCompact) return;

    const browser = getInAppBrowser();
    if (!browser) return;

    if (isOpen && browser && !isBrowserHidden) {
      isBrowserHidden = true;

      browser.hide().then(async () => {
        if (IS_DELEGATING_BOTTOM_SHEET) {
          await BottomSheet.enable();
        }
      });
    }
  }, [isCompact, isOpen]);

  return useLastCallback(async () => {
    if (!isCompact && isBrowserHidden) {
      if (IS_DELEGATING_BOTTOM_SHEET) {
        await BottomSheet.disable();
      }

      const browser = getInAppBrowser()!;
      browser.show();

      isBrowserHidden = false;
    }

    onCloseAnimationEnd?.();
  });
}
