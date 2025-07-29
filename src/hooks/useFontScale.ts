import { type ElementRef, useRef } from '../lib/teact/teact';

import { suppressStrict } from '../lib/fasterdom/stricterdom';
import buildClassName from '../util/buildClassName';
import useLastCallback from './useLastCallback';

const MIN_SIZE_SCALE = 0.25; // 12px

function useFontScale(inputRef: ElementRef<HTMLElement>, shouldGetParentWidth?: boolean) {
  const isFontChangedRef = useRef(false);
  const measureEl = useRef(document.createElement('div'));

  const updateFontScale = useLastCallback(() => {
    const input = inputRef.current;

    suppressStrict(() => {
      if (!input?.offsetParent) return;

      let { clientWidth: width } = shouldGetParentWidth ? input.parentElement! : input;

      if (shouldGetParentWidth) {
        const { paddingLeft, paddingRight } = getComputedStyle(input);
        width -= parseFloat(paddingLeft) + parseFloat(paddingRight);
      }
      measureEl.current.className = buildClassName(input.className, 'measure-hidden');
      measureEl.current.style.width = `${width}px`;
      measureEl.current.innerHTML = ''; // `measureEl.current.innerHTML = input.innerHTML` is not used, because it violates the CSP
      measureEl.current.append(...input.cloneNode(true).childNodes);
      document.body.appendChild(measureEl.current);

      let scale = 1;

      while (scale > MIN_SIZE_SCALE) {
        measureEl.current.style.setProperty('--font-size-scale', scale.toString());

        if (measureEl.current.scrollWidth <= width) break;
        scale -= 0.05;
      }

      isFontChangedRef.current = scale < 1;
      document.body.removeChild(measureEl.current);
      measureEl.current.className = '';
      input.style.setProperty('--font-size-scale', scale.toString());
    });
  });

  return { updateFontScale, isFontChangedRef };
}

export default useFontScale;
