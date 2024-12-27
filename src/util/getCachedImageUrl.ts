import { IMAGE_CACHE_NAME } from '../config';

export async function getCachedImageUrl(url: string) {
  const cache = await caches.open(IMAGE_CACHE_NAME);

  const cachedResponse = await cache.match(url);
  if (cachedResponse) {
    const blob = await cachedResponse.blob();

    return URL.createObjectURL(blob);
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Image loading error: ${response.statusText}. URL: ${url}`);
  }

  await cache.put(url, response.clone());
  const blob = await response.blob();

  return URL.createObjectURL(blob);
}
