export const DETACHED_TAB_URL = '#detached';

let ledgerTabId: number | undefined;

/**
 * In order to connect to Ledger, the webapp needs to get the user permission to use the HID device. Chrome doesn't ask
 * the user to choose a device when the code runs in the extension popup: https://issues.chromium.org/issues/40233645.
 * So in case of extension we open a browser tab which asks the permission. The tab runs the same webapp but with a
 * limited UI. Once the user grants the permission, the extension can continue connecting to Ledger inside the popup.
 */
export function openLedgerTab() {
  return createLedgerTab();
}

export function closeLedgerTab() {
  if (!ledgerTabId) return;

  chrome.tabs.query({ active: true }, () => {
    if (!ledgerTabId) return;

    void chrome.tabs.remove(ledgerTabId);
  });
}

export async function closeThisTab() {
  const tab = await chrome.tabs.getCurrent();
  if (!tab?.id) return;
  await chrome.tabs.remove(tab.id);
}

export function onLedgerTabClose(id: number, onClose: () => void) {
  const listener = (closedTabId: number) => {
    if (closedTabId !== id) {
      return;
    }

    ledgerTabId = undefined;
    chrome.tabs.onRemoved.removeListener(listener);
    onClose();
  };

  chrome.tabs.onRemoved.addListener(listener);
}

async function createLedgerTab() {
  const tab = await chrome.tabs.create({ url: `index.html${DETACHED_TAB_URL}`, active: true });
  await chrome.windows.update(tab.windowId, { focused: true });

  ledgerTabId = tab.id!;

  return ledgerTabId;
}
