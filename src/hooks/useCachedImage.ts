import { useEffect } from '../lib/teact/teact';

import { getCachedImageUrl } from '../util/getCachedImageUrl';
import useAsync from './useAsync';

export function useCachedImage(src?: string) {
  const { result: imageUrl } = useAsync(
    () => (src ? getCachedImageUrl(src) : Promise.resolve(undefined)),
    [src],
  );

  useEffect(() => {
    return imageUrl ? () => {
      URL.revokeObjectURL(imageUrl);
    } : undefined;
  }, [imageUrl]);

  return { imageUrl };
}
