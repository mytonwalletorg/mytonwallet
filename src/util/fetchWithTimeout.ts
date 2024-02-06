import { DEFAULT_API_TIMEOUT } from '../config';

async function fetchWithTimeout(url: string | URL, init?: RequestInit, timeout = DEFAULT_API_TIMEOUT) {
  const controller = new AbortController();
  const id = setTimeout(() => {
    controller.abort();
  }, timeout);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(id);
  }
}

export default fetchWithTimeout;
