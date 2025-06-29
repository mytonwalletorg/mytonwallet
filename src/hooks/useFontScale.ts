import { type ElementRef, useRef } from '../lib/teact/teact';

import { suppressStrict } from '../lib/fasterdom/stricterdom';
import buildClassName from '../util/buildClassName';

const MIN_SIZE_SCALE = 0.25; // 12px

function useFontScale(inputRef: ElementRef<HTMLElement>, shouldGetParentWidth?: boolean) {
  const isFontChangedRef = useRef(false);
  const measureEl = useRef(document.createElement('div'));

  const updateFontScale = (contentHtml: string) => {
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
      measureEl.current.innerHTML = contentHtml;
      document.body.appendChild(measureEl.current);

      let delta = 1;

      while (delta > MIN_SIZE_SCALE) {
        measureEl.current.style.setProperty('--base-font-size', delta.toString());

        if (measureEl.current.scrollWidth <= width) break;
        delta -= 0.05;
      }

      isFontChangedRef.current = delta < 1;
      document.body.removeChild(measureEl.current);
      measureEl.current.className = '';
      input.style.setProperty('--base-font-size', delta.toString());
    });
  };

  return { updateFontScale, isFontChangedRef };
}

export default useFontScale;
