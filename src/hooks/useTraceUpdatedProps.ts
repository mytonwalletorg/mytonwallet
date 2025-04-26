import { useEffect, useRef } from '../lib/teact/teact';

import isEmptyObject from '../util/isEmptyObject';

/**
 * Custom React hook for tracing updates to props.
 * This hook logs the changed properties of a component every time it re-renders.
 * It is useful for debugging purposes to see which props have changed between renders.
 *
 * @param {Record<string, any>} props - The current props of the component.
 * @param {boolean} [shouldTrace=false] - Flag to enable or disable tracing of prop changes.
 *                                      - When true, the hook logs the changes to the console.
 *                                      - Default is false, meaning tracing is off by default.
 */
export default function useTraceUpdatedProps(props: Record<string, any>, shouldTrace = false) {
  const prevProps = useRef<Record<string, any>>();

  useEffect(() => {
    const changedProps = Object.entries(props).reduce((acc: Record<string, any>, [key, value]) => {
      if (prevProps.current) {
        if (prevProps.current[key] !== value) {
          acc[key] = { old: prevProps.current[key], new: value };
        }
      }
      return acc;
    }, {});

    if (!isEmptyObject(changedProps) && shouldTrace) {
      // eslint-disable-next-line no-console
      console.log('Changed props:', changedProps);
    }

    prevProps.current = props;
  });
}
