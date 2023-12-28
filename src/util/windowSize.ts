import { IS_CAPACITOR } from '../config';
import { requestMutation } from '../lib/fasterdom/fasterdom';
import { throttle } from './schedulers';
import { IS_ANDROID, IS_IOS } from './windowEnvironment';

const WINDOW_RESIZE_THROTTLE_MS = 250;
const WINDOW_ORIENTATION_CHANGE_THROTTLE_MS = IS_IOS ? 350 : 250;
const SAFE_AREA_INITIALIZATION_DELAY = 1000;

const initialHeight = window.innerHeight;

let currentWindowSize = updateSizes();

window.addEventListener('orientationchange', throttle(() => {
  currentWindowSize = updateSizes();
}, WINDOW_ORIENTATION_CHANGE_THROTTLE_MS, false));

if (!IS_IOS) {
  window.addEventListener('resize', throttle(() => {
    currentWindowSize = updateSizes();
  }, WINDOW_RESIZE_THROTTLE_MS, true));
}

if ('visualViewport' in window && (IS_IOS || IS_ANDROID)) {
  window.visualViewport!.addEventListener('resize', throttle((e: Event) => {
    const target = e.target as VisualViewport;
    currentWindowSize = {
      width: window.innerWidth,
      height: target.height,
      screenHeight: window.screen.height,
      safeAreaTop: getSafeAreaTop(),
      safeAreaBottom: getSafeAreaBottom(),
    };
  }, WINDOW_RESIZE_THROTTLE_MS, true));
}

export function updateSizes() {
  patchVh();
  patchSafeAreaProperty();

  return {
    width: window.innerWidth,
    height: window.innerHeight,
    screenHeight: window.screen.height,
    safeAreaTop: getSafeAreaTop(),
    safeAreaBottom: getSafeAreaBottom(),
  };
}

export default {
  get: () => currentWindowSize,
  getIsKeyboardVisible: () => initialHeight > currentWindowSize.height,
};

function patchVh() {
  if (!(IS_IOS || IS_ANDROID) || IS_CAPACITOR) return;

  const height = IS_IOS ? window.visualViewport!.height + window.visualViewport!.pageTop : window.innerHeight;

  requestMutation(() => {
    const vh = height * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  });
}

function patchSafeAreaProperty() {
  const { documentElement } = document;

  // WebKit has issues with this property on page load
  // https://bugs.webkit.org/show_bug.cgi?id=191872
  setTimeout(() => {
    const { safeAreaTop, safeAreaBottom } = currentWindowSize;

    if (!Number.isNaN(safeAreaTop) && safeAreaTop > 0) {
      requestMutation(() => {
        documentElement.classList.add('with-safe-area-top');
      });
    }
    if (!Number.isNaN(safeAreaBottom) && safeAreaBottom > 0) {
      requestMutation(() => {
        documentElement.classList.add('with-safe-area-bottom');
      });
    }
  }, SAFE_AREA_INITIALIZATION_DELAY);
}

function getSafeAreaTop() {
  const value = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--safe-area-top-value'), 10);

  return Number.isNaN(value) ? 0 : value;
}

function getSafeAreaBottom() {
  const value = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--safe-area-bottom-value'), 10);

  return Number.isNaN(value) ? 0 : value;
}
