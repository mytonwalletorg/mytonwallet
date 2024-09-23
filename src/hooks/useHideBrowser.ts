import { BottomSheet } from 'native-bottom-sheet';

import { IS_CAPACITOR } from '../config';
import { IS_DELEGATED_BOTTOM_SHEET, IS_DELEGATING_BOTTOM_SHEET } from '../util/windowEnvironment';
import useSyncEffect from './useSyncEffect';

import { getInAppBrowser } from '../components/ui/InAppBrowser';

export default function useHideBrowser(
  isOpen?: boolean,
  isCompact?: boolean,
) {
  useSyncEffect(() => {
    if (!IS_CAPACITOR || IS_DELEGATED_BOTTOM_SHEET || isCompact) return;

    const browser = getInAppBrowser();
    if (!browser) return;

    if (isOpen && browser) {
      browser.hide().then(async () => {
        if (IS_DELEGATING_BOTTOM_SHEET) {
          await BottomSheet.enable();
        }
      });
    }
  }, [isCompact, isOpen]);
}
