import { CONTENT_SCRIPT_PORT, PROVIDER_CHANNEL } from './config';

(function injectScript() {
  const scriptTag = document.createElement('script');
  scriptTag.async = true;
  scriptTag.src = chrome.runtime.getURL('/extensionProvider.js');

  const container = document.head || document.documentElement;
  container.appendChild(scriptTag);

  scriptTag.remove();
}());

const PAGE_ORIGIN = window.location.href;

let port: chrome.runtime.Port;

window.addEventListener('message', handlePageMessage);

connectPort();

function handlePageMessage(e: MessageEvent) {
  if (e.data?.channel === PROVIDER_CHANNEL) {
    sendToPort(e.data);
  }
}

function connectPort() {
  port = chrome.runtime.connect({ name: CONTENT_SCRIPT_PORT });
  port.onMessage.addListener(sendToPage);
}

function sendToPage(payload: any) {
  window.postMessage(payload, PAGE_ORIGIN);
}

function sendToPort(payload: any, isRepeated = false) {
  try {
    port.postMessage(payload);
  } catch (err: any) {
    const isInvalidated = err.message.toString().includes('Extension context invalidated');
    if (isInvalidated) {
      window.removeEventListener('message', handlePageMessage);
      return;
    }

    const isDisconnected = err.message.toString().includes('disconnected port');
    if (isDisconnected && !isRepeated) {
      connectPort();
      sendToPort(payload, true);
    }
  }
}
