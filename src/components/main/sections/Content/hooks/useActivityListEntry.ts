import { useRef } from '../../../../../lib/teact/teact';

import { requestMutation } from '../../../../../lib/fasterdom/fasterdom';

import useLayoutEffectWithPrevDeps from '../../../../../hooks/useLayoutEffectWithPrevDeps';

import styles from '../Activities.module.scss';

const ANIMATION_DURATION = 200;
const ANIMATION_END_DELAY = 50;

export default function useActivityListEntry(
  withAnimation: boolean,
  topOffset: number, // rem
) {
  const ref = useRef<HTMLDivElement>();

  useLayoutEffectWithPrevDeps(([prevTopOffset]) => {
    const element = ref.current;

    if (!withAnimation || !element) {
      return;
    }

    if (prevTopOffset === undefined) {
      // A new activity
      animateOpacity(element);
      cleanupAnimation(element);
    } else if (topOffset !== prevTopOffset) {
      // An existing activity that has moved
      animateMove(element, topOffset - prevTopOffset);
      cleanupAnimation(element);
    }
  }, [topOffset, withAnimation]);

  return { ref };
}

function animateOpacity(element: HTMLElement) {
  element.style.opacity = '0';

  requestMutation(() => {
    element.classList.add(styles.animateOpacity);
    element.style.opacity = '1';
  });
}

function animateMove(element: HTMLElement, offsetY: number) {
  element.style.transform = `translate3d(0, ${-offsetY}rem, 0)`;

  requestMutation(() => {
    element.classList.add(styles.animateTransform);
    element.style.transform = '';
  });
}

function cleanupAnimation(element: HTMLElement) {
  setTimeout(() => {
    requestMutation(() => {
      element.classList.remove(styles.animateOpacity, styles.animateTransform);
      element.style.opacity = '';
      element.style.transform = '';
    });
  }, ANIMATION_DURATION + ANIMATION_END_DELAY);
}
