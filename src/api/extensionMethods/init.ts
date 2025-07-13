import type { OnApiUpdate } from '../types';

import { addHooks } from '../hooks';
import * as legacyDappMethods from './legacy';
import * as siteMethods from './sites';
import { openPopupWindow } from './window';
import * as extensionMethods from '.';

addHooks({
  onWindowNeeded: openPopupWindow,
  onFullLogout: extensionMethods.onFullLogout,
  onDappDisconnected: (_, url) => {
    siteMethods.updateSites({
      type: 'disconnectSite',
      url,
    });
  },
});

export default function init(onUpdate: OnApiUpdate) {
  void extensionMethods.initExtension();
  legacyDappMethods.initLegacyDappMethods(onUpdate);
  siteMethods.initSiteMethods(onUpdate);
}
