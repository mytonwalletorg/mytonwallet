import { useRef } from '../lib/teact/teact';

import generateUniqueId from '../util/generateUniqueId';
import useSyncEffect from './useSyncEffect';

export default function useUniqueId(prefix = '') {
  const idRef = useRef<string>();

  useSyncEffect(() => {
    idRef.current = prefix + generateUniqueId();
  }, [prefix]);

  return idRef.current!;
}
