import { useRef } from '../lib/teact/teact';

import { forceMeasure } from '../lib/fasterdom/stricterdom';
import buildClassName from '../util/buildClassName';

const MIN_SIZE_SCALE = 0.25; // 12px

function useFontScale(inputRef: React.RefObject<HTMLElement>, shouldGetParentWidth?: boolean) {
  const isFontChangedRef = useRef(false);
  const measureEl = useRef(document.createElement('div'));

  const updateFontScale = (content: string) => {
    const input = inputRef.current;
    if (!input) return;

    forceMeasure(() => {
      let { clientWidth: width } = shouldGetParentWidth ? input.parentElement! : input;
      if (shouldGetParentWidth) {
        const { paddingLeft, paddingRight } = getComputedStyle(input);
        width -= parseFloat(paddingLeft) + parseFloat(paddingRight);
      }
      measureEl.current.className = buildClassName(input.className, 'measure-hidden');
      measureEl.current.style.width = `${width}px`;
      measureEl.current.innerHTML = content;
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
