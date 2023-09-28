import { requestMeasure, requestMutation } from '../lib/fasterdom/fasterdom';
import useLastCallback from './useLastCallback';

// Set `min-height` for transition container to prevent jumping when switching tabs
export default function useTransitionFixes(
  containerRef: { current: HTMLDivElement | null },
  transitionElSelector: string,
  tabsElSelector: string,
) {
  const applyTransitionFix = useLastCallback(() => {
    // This callback is called from `Transition.onStart` which is "mutate" phase
    requestMeasure(() => {
      const container = containerRef.current;
      if (!container) return;

      const transitionEl = container.querySelector<HTMLDivElement>(transitionElSelector);
      const tabsEl = container.querySelector<HTMLDivElement>(tabsElSelector);
      if (transitionEl && tabsEl) {
        const newHeight = container.offsetHeight - tabsEl.offsetHeight;

        requestMutation(() => {
          transitionEl.style.minHeight = `${newHeight}px`;
        });
      }
    });
  });

  const releaseTransitionFix = useLastCallback(() => {
    const container = containerRef.current!;
    if (!container) return;

    const transitionEl = container.querySelector<HTMLDivElement>(transitionElSelector);
    if (transitionEl) {
      transitionEl.style.minHeight = '';
    }
  });

  return { applyTransitionFix, releaseTransitionFix };
}
