import type { DropdownItem } from '../../../../ui/Dropdown';

import { MYTONWALLET_MULTISEND_DAPP_URL } from '../../../../../config';
import { vibrate } from '../../../../../util/haptics';
import { getTranslation } from '../../../../../util/langProvider';
import { openUrl } from '../../../../../util/openUrl';
import { getHostnameFromUrl } from '../../../../../util/url';

export type MenuHandler = 'multisend';

export const SEND_CONTEXT_MENU_ITEMS: DropdownItem<MenuHandler>[] = [{
  name: 'Multisend',
  fontIcon: 'menu-multisend',
  value: 'multisend',
}];

export function handleSendMenuItemClick(value: MenuHandler) {
  if (value === 'multisend') {
    void vibrate();
    void openUrl(MYTONWALLET_MULTISEND_DAPP_URL, {
      title: getTranslation('Multisend'),
      subtitle: getHostnameFromUrl(MYTONWALLET_MULTISEND_DAPP_URL),
    });
  }
}
