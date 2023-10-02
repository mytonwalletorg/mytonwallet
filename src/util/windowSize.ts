import { requestMutation } from '../lib/fasterdom/fasterdom';
import { throttle } from './schedulers';
import { IS_ANDROID, IS_IOS } from './windowEnvironment';

export type IDimensions = {
  width: number;
  height: number;
};

const WINDOW_RESIZE_THROTTLE_MS = 250;
const WINDOW_ORIENTATION_CHANGE_THROTTLE_MS = IS_IOS ? 350 : 250;

const initialHeight = window.innerHeight;
let currentWindowSize = updateSizes();

const handleResize = throttle(() => {
  currentWindowSize = updateSizes();
}, WINDOW_RESIZE_THROTTLE_MS, true);

const handleViewportResize = throttle((e: Event) => {
  const target = e.target as VisualViewport;
  currentWindowSize = {
    width: window.innerWidth,
    height: target.height,
  };
}, WINDOW_RESIZE_THROTTLE_MS, true);

const handleOrientationChange = throttle(() => {
  currentWindowSize = updateSizes();
}, WINDOW_ORIENTATION_CHANGE_THROTTLE_MS, false);

window.addEventListener('orientationchange', handleOrientationChange);
if (!IS_IOS) {
  window.addEventListener('resize', handleResize);
}

if ('visualViewport' in window && (IS_IOS || IS_ANDROID)) {
  window.visualViewport!.addEventListener('resize', handleViewportResize);
}

export function updateSizes(): IDimensions {
  let height: number;
  if (IS_IOS) {
    height = window.visualViewport!.height + window.visualViewport!.pageTop;
  } else {
    height = window.innerHeight;
  }

  requestMutation(() => {
    const vh = height * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  });

  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

const windowSize = {
  get: () => currentWindowSize,
  getIsKeyboardVisible: () => initialHeight > currentWindowSize.height,
};

export default windowSize;
