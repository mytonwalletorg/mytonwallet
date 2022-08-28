import { IS_IOS } from './environment';

window.addEventListener('orientationchange', updateSizes);
if (IS_IOS) {
  window.visualViewport.addEventListener('resize', updateSizes);
} else {
  window.addEventListener('resize', updateSizes);
}

export function updateSizes() {
  let height: number;
  if (IS_IOS) {
    height = window.visualViewport.height + window.visualViewport.pageTop;
  } else {
    height = window.innerHeight;
  }
  const vh = height * 0.01;

  document.documentElement.style.setProperty('--vh', `${vh}px`);
}
