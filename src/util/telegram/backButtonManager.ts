import { logDebugError } from '../logs';
import { debounce } from '../schedulers';
import { getTelegramApp } from './index';

interface CallbackEntry {
  id: number;
  callback: NoneToVoidFunction;
}

const runDebounce = debounce((cb) => cb(), 300, false);
const callbacks: CallbackEntry[] = [];
let isGlobalHandlerAttached = false;
let uniqueId = 0;

function getNextId() {
  uniqueId += 1;
  return uniqueId;
}

function updateBackButtonState() {
  const backButton = getTelegramApp()!.BackButton;

  if (callbacks.length > 0 && !isGlobalHandlerAttached) {
    backButton.show();
    backButton.onClick(handleBackButtonClick);
    isGlobalHandlerAttached = true;
  } else if (!callbacks.length && isGlobalHandlerAttached) {
    backButton.hide();
    backButton.offClick(handleBackButtonClick);
    isGlobalHandlerAttached = false;
  }
}

export function registerCallback(cb: NoneToVoidFunction) {
  const id = getNextId();
  callbacks.push({ id, callback: cb });
  runDebounce(updateBackButtonState);
  return id;
}

export function unregisterCallback(id: number) {
  const index = callbacks.findIndex((entry) => entry.id === id);
  if (index !== -1) {
    callbacks.splice(index, 1);
    runDebounce(updateBackButtonState);
  }
}

function handleBackButtonClick() {
  if (callbacks.length > 0) {
    const entry = callbacks.pop()!;
    try {
      entry.callback();
    } catch (err: any) {
      logDebugError('[handleBackButtonClick]', err);
    }
  }

  runDebounce(updateBackButtonState);
}
