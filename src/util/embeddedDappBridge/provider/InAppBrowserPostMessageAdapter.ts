export default class InAppBrowserPostMessageAdapter {
  constructor(private inAppBrowser: Cordova['InAppBrowser']) {
  }

  addEventListener(eventName: 'message', handler: (event: any) => void) {
    void this.inAppBrowser.addEventListener(eventName, handler);
  }

  removeEventListener(eventName: 'message', handler: (event: any) => void) {
    void this.inAppBrowser.removeEventListener(eventName, handler);
  }

  postMessage(message: any) {
    void this.inAppBrowser.executeScript({
      code: `window.dispatchEvent(new MessageEvent('message', { data: ${JSON.stringify(message)} }));`,
    });
  }
}
