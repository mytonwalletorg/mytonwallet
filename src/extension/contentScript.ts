import extension from '../lib/webextension-polyfill';

import '../api/providers/extension/pageContentProxy';

(function injectScript() {
  const scriptTag = document.createElement('script');
  scriptTag.async = true;
  scriptTag.src = extension.runtime.getURL('/extensionPageScript.js');

  const container = document.head || document.documentElement;
  container.appendChild(scriptTag);

  scriptTag.remove();
}());
