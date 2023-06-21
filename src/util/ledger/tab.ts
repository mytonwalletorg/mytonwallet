export const DETACHED_TAB_URL = '#detached';

export function openLedgerTab() {
  return createLedgerTab();
}

export function onLedgerTabClose(id: number, onClose: () => void) {
  chrome.tabs.onRemoved.addListener((closedTabId: number) => {
    if (closedTabId !== id) {
      return;
    }

    onClose();
  });
}

async function createLedgerTab() {
  const tab = await chrome.tabs.create({ url: `index.html${DETACHED_TAB_URL}`, active: true });
  await chrome.windows.update(tab.windowId!, { focused: true });
  return tab.id!;
}
