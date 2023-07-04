import type { RefObject } from 'react';
import { requestMutation } from '../lib/fasterdom/fasterdom';
import { useEffect } from '../lib/teact/teact';

import { IS_TOUCH_ENV } from '../util/windowEnvironment';

const DEFAULT_DURATION = 400;

export default function useFocusAfterAnimation(
  ref: RefObject<HTMLInputElement>, isDisabled = false, animationDuration = DEFAULT_DURATION,
) {
  useEffect(() => {
    if (IS_TOUCH_ENV || isDisabled) {
      return;
    }

    setTimeout(() => {
      requestMutation(() => {
        ref.current?.focus();
      });
    }, animationDuration);
  }, [ref, animationDuration, isDisabled]);
}
