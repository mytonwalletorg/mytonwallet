// eslint-disable-next-line no-restricted-globals
const cacheApi = self.caches;

export async function fetch(cacheName: string, key: string) {
  if (!cacheApi) {
    return undefined;
  }

  try {
    // To avoid the error "Request scheme 'webdocument' is unsupported"
    const request = new Request(key.replace(/:/g, '_'));
    const cache = await cacheApi.open(cacheName);
    const response = await cache.match(request);
    if (!response) {
      return undefined;
    }

    return await response.json();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(err);
    return undefined;
  }
}

export async function save(cacheName: string, key: string, data: AnyLiteral | Blob | ArrayBuffer | string) {
  if (!cacheApi) {
    return undefined;
  }

  try {
    const cacheData = typeof data === 'string' || data instanceof Blob || data instanceof ArrayBuffer
      ? data
      : JSON.stringify(data);
    // To avoid the error "Request scheme 'webdocument' is unsupported"
    const request = new Request(key.replace(/:/g, '_'));
    const response = new Response(cacheData);
    const cache = await cacheApi.open(cacheName);
    return await cache.put(request, response);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(err);
    return undefined;
  }
}

export async function remove(cacheName: string, key: string) {
  try {
    if (!cacheApi) {
      return undefined;
    }

    const cache = await cacheApi.open(cacheName);
    return await cache.delete(key);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(err);
    return undefined;
  }
}

export async function clear(cacheName: string) {
  try {
    if (!cacheApi) {
      return undefined;
    }

    return await cacheApi.delete(cacheName);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(err);
    return undefined;
  }
}
