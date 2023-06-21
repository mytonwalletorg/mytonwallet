import { DETACHED_TAB_URL } from './ledger/tab';

const STORAGE_KEY = 'mtw-active-tab';
const INTERVAL = 2000;

const tabKey = String(Date.now() + Math.random());

if (!window.location.href.includes(DETACHED_TAB_URL)) {
  localStorage.setItem(STORAGE_KEY, tabKey);
}

let callback: NoneToVoidFunction;

const interval = window.setInterval(() => {
  if (callback && localStorage.getItem(STORAGE_KEY) !== tabKey && !window.location.href.includes(DETACHED_TAB_URL)) {
    callback();
    clearInterval(interval);
  }
}, INTERVAL);

export function setActiveTabChangeListener(_callback: NoneToVoidFunction) {
  callback = _callback;
}
