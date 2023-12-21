export const DETACHED_TAB_URL = '#detached';

let ledgerTabId: number | undefined;

export function openLedgerTab() {
  return createLedgerTab();
}

export async function closeLedgerTab() {
  if (!ledgerTabId) return;

  await chrome.tabs.query({ active: true }, () => {
    if (!ledgerTabId) return;

    chrome.tabs.remove(ledgerTabId);
  });
}

export function onLedgerTabClose(id: number, onClose: () => void) {
  chrome.tabs.onRemoved.addListener((closedTabId: number) => {
    if (closedTabId !== id) {
      return;
    }

    ledgerTabId = undefined;

    onClose();
  });
}

async function createLedgerTab() {
  const tab = await chrome.tabs.create({ url: `index.html${DETACHED_TAB_URL}`, active: true });
  await chrome.windows.update(tab.windowId!, { focused: true });

  ledgerTabId = tab.id!;

  return ledgerTabId;
}
