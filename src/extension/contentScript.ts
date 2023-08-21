import '../api/providers/extension/pageContentProxy';

(function injectScript() {
  const scriptTag = document.createElement('script');
  scriptTag.async = true;
  scriptTag.src = chrome.runtime.getURL('/extensionPageScript.js');

  const container = document.head || document.documentElement;
  container.appendChild(scriptTag);

  scriptTag.remove();
}());
