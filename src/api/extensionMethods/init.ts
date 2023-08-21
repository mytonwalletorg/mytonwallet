import type { OnApiUpdate } from '../types';

import * as legacyDappMethods from './legacy';
import * as siteMethods from './sites';
import { openPopupWindow } from './window';
import * as extensionMethods from '.';

import { addHooks } from '../hooks';

addHooks({
  onWindowNeeded: openPopupWindow,
  onFirstLogin: extensionMethods.setupDefaultExtensionFeatures,
  onFullLogout: extensionMethods.clearExtensionFeatures,
  onDappDisconnected: () => {
    siteMethods.updateSites({
      type: 'disconnectSite',
      origin,
    });
  },
});

export default function init(onUpdate: OnApiUpdate) {
  void extensionMethods.initExtension(onUpdate);
  legacyDappMethods.initLegacyDappMethods(onUpdate);
  siteMethods.initSiteMethods(onUpdate);
}
